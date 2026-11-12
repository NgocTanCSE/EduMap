//! Geo / GeoVision module — `/api/geo/*`: ghép mảnh bản đồ vệ tinh (satellite
//! tiles) và phát hiện cơ sở vật chất giáo dục qua AI vision.
//!
//! Mirrors `backend/src/modules/geo/geo-vision.controller.ts` +
//! `geo-vision.service.ts`. Cả hai endpoint đều công khai (old controller
//! không có guard) và `@SkipThrottle()` — không áp dụng throttle ở đây.
//!
//! - `GET /api/geo/satellite-tiles?bbox=&zoom=&source=` — lấy mảnh tile (Esri/Bing),
//!   ghép thành một PNG và trả về base64. Kết quả được cache trong
//!   bộ nhớ 24h (giống `tileCache` cũ, tối đa 64 entry).
//! - `POST /api/geo/vision-detect` — gửi ảnh ghép vào mô hình vision trên
//!   ai-service (`/api/ai/geo/vision-detect`), đánh dấu các phát hiện trùng/
//!   mới so với `map_points` trong bbox. Khi ai-service hoặc mô hình không
//!   phản hồi, trả về `degraded: true` + danh sách rỗng — **không được 500**.

use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Query, State};
use axum::Json;
use base64::{Engine as _, engine::general_purpose};
use futures::future::join_all;
use once_cell::sync::OnceLock;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SatelliteTilesQuery {
    pub bbox: String,
    pub zoom: Option<i64>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VisionDetectBody {
    pub bbox: String,
    pub zoom: Option<i64>,
    pub source: Option<String>,
    pub labels: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE: i64 = 256;
const MAX_GRID: usize = 8;
const CACHE_TTL_MS: i64 = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES: usize = 64;
const MATCH_THRESHOLD_M: f64 = 80.0;
const EARTH_RADIUS_M: f64 = 6_371_000.0;

#[derive(Debug, Clone)]
struct CachedTileData {
    image_base64: String,
    width: i64,
    height: i64,
    bbox: Bbox,
    zoom: i64,
    tile_count: i64,
    tile_coords: Vec<TileCoord>,
    source: String,
}

#[derive(Debug, Clone)]
struct TileCoord {
    x: i64,
    y: i64,
    z: i64,
}

#[derive(Debug, Clone, Copy)]
struct Bbox {
    min_lat: f64,
    max_lat: f64,
    min_lng: f64,
    max_lng: f64,
}

/// LRU-style cache cho mảnh tile đã ghép (không ghi DB, trong bộ nhớ).
#[derive(Default)]
struct TileCache {
    entries: HashMap<String, CachedTileData>,
    order: Vec<String>,
}

impl TileCache {
    fn get(&self, key: &str) -> Option<&CachedTileData> {
        self.entries.get(key)
    }
    fn set(&mut self, key: String, value: CachedTileData) {
        if self.entries.len() >= CACHE_MAX_ENTRIES && !self.entries.is_empty() {
            if let Some(oldest) = self.order.first().cloned() {
                self.entries.remove(&oldest);
                self.order.retain(|k| k != &oldest);
            }
        }
        self.order.push(key.clone());
        self.entries.insert(key, value);
    }
}

static TILE_CACHE: OnceLock<Arc<Mutex<TileCache>>> = OnceLock::new();

fn tile_cache() -> Arc<Mutex<TileCache>> {
    TILE_CACHE
        .get_or_init(|| Arc::new(Mutex::new(TileCache::default())))
        .clone()
}

fn client() -> Client {
    static C: OnceLock<Client> = OnceLock::new();
    C.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(10))
            .user_agent("EduMap-GeoVision/1.0")
            .build()
            .expect("build geo client")
    })
    .clone()
}

// ---------------------------------------------------------------------------
// Geometry helpers (giống old service)
// ---------------------------------------------------------------------------

fn deg2rad(d: f64) -> f64 {
    d * std::f64::consts::PI / 180.0
}

fn lat_lng_to_tile(lat: f64, lng: f64, z: i64) -> (i64, i64) {
    let lat_rad = deg2rad(lat);
    let n = (1u64 << z) as f64;
    let x = ((lng + 180.0) / 360.0) * n;
    let y = (1.0 - ((lat_rad.tan() + 1.0 / lat_rad.cos()).ln() / std::f64::consts::PI) / 2.0) * n;
    (x.floor() as i64, y.floor() as i64)
}

fn tile_bounds(x: i64, y: i64, z: i64) -> (f64, f64, f64, f64) {
    let n = (1u64 << z) as f64;
    let west = (x as f64 / n) * 360.0 - 180.0;
    let east = ((x as f64 + 1.0) / n) * 360.0 - 180.0;
    let north = ((std::f64::consts::PI * (1.0 - 2.0 * y as f64 / n)).sinh().atan() * 180.0) / std::f64::consts::PI;
    let south = ((std::f64::consts::PI * (1.0 - 2.0 * (y as f64 + 1.0) / n)).sinh().atan() * 180.0) / std::f64::consts::PI;
    (north, south, east, west)
}

fn pixel_to_lat_lng(px: f64, py: f64, start_tile_x: i64, start_tile_y: i64, z: i64) -> (f64, f64) {
    let n = (1u64 << z) as f64;
    let exact_x = start_tile_x as f64 + px / TILE_SIZE as f64;
    let exact_y = start_tile_y as f64 + py / TILE_SIZE as f64;
    let lng = (exact_x / n) * 360.0 - 180.0;
    let lat = ((std::f64::consts::PI * (1.0 - 2.0 * exact_y / n)).sinh().atan() * 180.0) / std::f64::consts::PI;
    (lat, lng)
}

fn tile_url(x: i64, y: i64, z: i64, source: &str, bing_key: Option<&str>) -> String {
    match source {
        "bing" => {
            let mut qk = String::new();
            for i in (1..=z as u64).rev() {
                let mut digit = 0;
                let mask = 1u64 << (i - 1);
                if (x as u64 & mask) != 0 {
                    digit += 1;
                }
                if (y as u64 & mask) != 0 {
                    digit += 2;
                }
                qk.push_str(&digit.to_string());
            }
            let sub = "abcdefghijklmnopqrstuvwxyz"[(x + y) as usize % 3];
            match bing_key {
                Some(k) => format!("https://{sub}.ssl.ak.tiles.virtualearth.net/tiles/{qk}.png?token={k}"),
                None => format!("https://{sub}.ssl.ak.tiles.virtualearth.net/tiles/{qk}.png"),
            }
        }
        "esri" => format!("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"),
        // mặc định (esri satellite — ảnh vệ tinh, không phải OSM):
        _ => format!("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"),
    }
}

fn parse_bbox(bbox: &str) -> Result<Bbox, AppError> {
    let parts: Vec<&str> = bbox.split(',').map(|p| p.trim()).collect();
    if parts.len() != 4 {
        return Err(AppError::BadRequest(
            "Invalid bbox. Expected \"minLat,maxLat,minLng,maxLng\".".to_string(),
        ));
    }
    let mut nums = [0.0f64; 4];
    for (i, p) in parts.iter().enumerate() {
        nums[i] = p.parse().map_err(|_| AppError::BadRequest(format!("Invalid bbox number: \"{p}\"")))?;
    }
    if nums[0] > nums[1] || nums[2] > nums[3] {
        return Err(AppError::BadRequest("Invalid bbox: min must be <= max.".to_string()));
    }
    Ok(Bbox {
        min_lat: nums[0],
        max_lat: nums[1],
        min_lng: nums[2],
        max_lng: nums[3],
    })
}

fn haversine(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let d_lat = deg2rad(lat2 - lat1);
    let d_lng = deg2rad(lng2 - lng1);
    let a = (d_lat / 2.0).sin().powi(2)
        + deg2rad(lat1).cos() * deg2rad(lat2).cos() * (d_lng / 2.0).sin().powi(2);
    2.0 * a.sqrt().atan2((1.0 - a).sqrt()) * EARTH_RADIUS_M
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opt().unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| format!("{}", d.as_secs()))
            .unwrap_or_default()
    })
}

// ---------------------------------------------------------------------------
// Tile fetch + stitch
// ---------------------------------------------------------------------------

struct FetchedTile {
    x: i64,
    y: i64,
    buf: Vec<u8>,
}

async fn fetch_tile(x: i64, y: i64, z: i64, source: &str, bing_key: Option<&str>) -> Option<FetchedTile> {
    let url = tile_url(x, y, z, source, bing_key);
    match client().get(&url).send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(buf) if buf.len() >= 100 => Some(FetchedTile { x, y, buf: buf.to_vec() }),
            Ok(_) => None,
            Err(_) => None,
        },
        Err(_) => None,
    }
}

async fn fetch_and_stitch_tiles(
    bbox_str: &str,
    zoom: i64,
    source: &str,
) -> Result<CachedTileData, AppError> {
    let cache_key = format!("geovision:tiles:{bbox_str}:{zoom}:{source}");
    {
        let c = tile_cache().lock().unwrap();
        if let Some(cached) = c.get(&cache_key) {
            return Ok(cached.clone());
        }
    }

    let bounds = parse_bbox(bbox_str)?;
    let z = std::cmp::min(zoom, 20);
    let (tl_x, tl_y) = lat_lng_to_tile(bounds.max_lat, bounds.min_lng, z);
    let (br_x, br_y) = lat_lng_to_tile(bounds.min_lat, bounds.max_lng, z);

    let mut tile_xs: Vec<i64> = (tl_x..=br_x).collect();
    let mut tile_ys: Vec<i64> = (tl_y..=br_y).collect();
    if tile_xs.len() > MAX_GRID {
        tile_xs = tile_xs.into_iter().take(MAX_GRID).collect();
    }
    if tile_ys.len() > MAX_GRID {
        tile_ys = tile_ys.into_iter().take(MAX_GRID).collect();
    }
    let (cols, rows) = (tile_xs.len(), tile_ys.len());
    let (width, height) = (cols as i64 * TILE_SIZE, rows as i64 * TILE_SIZE);
    let tile_coords: Vec<TileCoord> = tile_ys
        .iter()
        .flat_map(|&y| tile_xs.iter().map(move |&x| TileCoord { x, y, z }))
        .collect();

    let bing_key: Option<String> = std::env::var("BING_MAPS_API_KEY").ok().filter(|v| !v.is_empty());
    let fetches: Vec<_> = tile_coords
        .iter()
        .map(|c| fetch_tile(c.x, c.y, c.z, source, bing_key.as_deref()))
        .collect();
    let results = join_all(fetches).await;

    let mut img = image::ImageBuffer::new(width as u32, height as u32);
    let mut fetched = 0;
    for res in results {
        let Some(tile) = res else {
            continue;
        };
        let col = tile.x - tile_xs[0];
        let row = tile.y - tile_ys[0];
        let decoded = match image::load_from_memory(&tile.buf) {
            Ok(d) => d,
            Err(_) => continue,
        };
        let cropped = if decoded.width() != TILE_SIZE as u32 || decoded.height() != TILE_SIZE as u32 {
            decoded.crop(0, 0, TILE_SIZE as u32, TILE_SIZE as u32)
        } else {
            decoded
        };
        if !ImageBuffer::copy_from(&mut img, &cropped.to_rgba8(), (col * TILE_SIZE) as u32, (row * TILE_SIZE) as u32)
        {
            continue;
        }
        fetched += 1;
    }
    if fetched == 0 {
        return Err(AppError::Internal(format!(
            "No tiles could be fetched for bbox {bbox_str} at zoom {z}."
        )));
    }

    let mut png = Vec::new();
    img.write_to(&mut png, image::ImageFormat::Png)
        .map_err(|e| AppError::Internal(format!("failed to encode stitched image: {e}")))?;

    let image_base64 = general_purpose::STANDARD.encode(&png);

    let data = CachedTileData {
        image_base64,
        width,
        height,
        bbox: bounds,
        zoom: z,
        tile_count: fetched as i64,
        tile_coords,
        source: source.to_string(),
    };
    tile_cache().lock().unwrap().set(cache_key.clone(), data.clone());
    Ok(data)
}

// ---------------------------------------------------------------------------
// DB + annotation
// ---------------------------------------------------------------------------

const DB_POINTS_IN_BOUNDS: &str = r#"
SELECT id, name, type_id,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng
FROM map_points
WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
  AND deleted_at IS NULL
LIMIT 5000
"#;

fn type_name(type_id: Option<i64>) -> String {
    match type_id.unwrap_or(0) {
        1 => "university",
        2 => "school",
        3 => "library",
        4 => "bookstore",
        5 => "lab",
        6 => "wifi",
        7 => "green",
        8 => "cafe",
        9 => "restaurant",
        10 => "market",
        11 => "convenience",
        _ => "other",
    }
    .to_string()
}

struct ExistingPoint {
    id: String,
    name: String,
    type_: String,
    lat: f64,
    lng: f64,
}

fn annotate_detections(
    detections: &[Value],
    start_tile_x: i64,
    start_tile_y: i64,
    z: i64,
    existing: &[ExistingPoint],
) -> (Vec<Value>, Vec<Value>, Vec<Value>) {
    let mut all = Vec::new();
    let mut known = Vec::new();
    let mut new = Vec::new();
    for d in detections {
        let box_ = d.get("box").cloned().unwrap_or_default();
        let xmin = box_.get("xmin").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let xmax = box_.get("xmax").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let ymin = box_.get("ymin").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let ymax = box_.get("ymax").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let center_px = (xmin + xmax) / 2.0;
        let center_py = (ymin + ymax) / 2.0;
        let (lat, lng) = pixel_to_lat_lng(center_px, center_py, start_tile_x, start_tile_y, z);

        let mut nearest: Option<Value> = None;
        let mut min_dist = f64::INFINITY;
        for p in existing {
            let dist = haversine(lat, lng, p.lat, p.lng);
            if dist < min_dist && dist < MATCH_THRESHOLD_M {
                min_dist = dist;
                nearest = Some(serde_json::json!({
                    "id": p.id, "name": p.name, "type": p.type_,
                    "lat": p.lat, "lng": p.lng, "distance_m": dist,
                }));
            }
        }

        let annotated = serde_json::json!({
            "score": d.get("score").cloned(),
            "label": d.get("label").cloned(),
            "box": box_,
            "lat": lat,
            "lng": lng,
            "match": nearest.as_ref().map_or("new", |_| "known"),
            "nearest_poi": nearest,
        });
        all.push(annotated.clone());
        if nearest.is_some() {
            known.push(annotated);
        } else {
            new.push(annotated);
        }
    }
    (all, known, new)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/geo/satellite-tiles?bbox=&zoom=&source=` — ghép mảnh bản đồ.
pub async fn get_satellite_tiles(
    Query(q): Query<SatelliteTilesQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    if q.bbox.is_empty() {
        return Ok(Json(ApiResponse::failure(
            "bbox query parameter is required. Format: minLat,maxLat,minLng,maxLng".to_string(),
        )));
    }
    let zoom = q.zoom.unwrap_or(18);
    let source = q.source.as_deref().unwrap_or("esri");

    let data = fetch_and_stitch_tiles(&q.bbox, zoom, source).await?;

    let result = serde_json::json!({
        "image_base64": data.image_base64,
        "width": data.width,
        "height": data.height,
        "bbox": {
            "minLat": data.bbox.min_lat,
            "maxLat": data.bbox.max_lat,
            "minLng": data.bbox.min_lng,
            "maxLng": data.bbox.max_lng,
        },
        "zoom": data.zoom,
        "tile_count": data.tile_count,
        "tile_coords": data.tile_coords.iter().map(|c| serde_json::json!({ "x": c.x, "y": c.y, "z": c.z })).collect::<Vec<_>>(),
        "source": data.source,
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `POST /api/geo/vision-detect` — phát hiện cơ sở vật chất giáo dục trong bbox.
/// Falls back to `degraded: true` khi ai-service/mô hình không trả lời.
pub async fn vision_detect(
    State(pool): State<DbPool>,
    Json(body): Json<VisionDetectBody>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    if body.bbox.is_empty() {
        return Ok(Json(ApiResponse::failure(
            "bbox is required. Format: \"minLat,maxLat,minLng,maxLng\"".to_string(),
        )));
    }
    let zoom = body.zoom.unwrap_or(18);
    let source = body.source.as_deref().unwrap_or("esri");

    let bounds = parse_bbox(&body.bbox)?;
    let tile_data = fetch_and_stitch_tiles(&body.bbox, zoom, source).await?;

    let start_tile_x = tile_data.tile_coords.iter().map(|c| c.x).min().unwrap_or(0);
    let start_tile_y = tile_data.tile_coords.iter().map(|c| c.y).min().unwrap_or(0);

    let mut payload = serde_json::json!({ "image_base64": tile_data.image_base64 });
    if let Some(labels) = body.labels.as_ref().filter(|v| !v.is_empty()) {
        payload.as_object_mut().unwrap().insert("labels".to_string(), serde_json::Value::Array(labels.clone()));
    }

    let ai_result = match crate::modules::proxy::proxy_to_ai_service("/api/ai/geo/vision-detect", payload).await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("vision-detect ai-service unavailable: {e}; degraded");
            serde_json::json!({ "detections": Vec::<Value>::new(), "degraded": true, "error": format!("{e}") })
        }
    };

    let detections = ai_result.get("detections").and_then(|d| d.as_array()).cloned().unwrap_or_default();
    let existing_rows = sqlx::query(DB_POINTS_IN_BOUNDS)
        .bind(bounds.min_lng)
        .bind(bounds.min_lat)
        .bind(bounds.max_lng)
        .bind(bounds.max_lat)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read map_points: {e}")))?;

    let existing: Vec<ExistingPoint> = existing_rows
        .into_iter()
        .map(|row| ExistingPoint {
            id: row.get::<String>("id"),
            name: row.get::<String>("name"),
            type_: type_name(row.get::<Option<i64>>("type_id")),
            lat: row.get::<f64>("lat"),
            lng: row.get::<f64>("lng"),
        })
        .collect();

    let (all, known, new) = annotate_detections(&detections, start_tile_x, start_tile_y, tile_data.zoom, &existing);
    let degraded = ai_result.get("degraded").and_then(|d| d.as_bool()).unwrap_or(false);
    let error = ai_result.get("error").and_then(|e| e.as_str()).map(|e| e.to_string());

    let result = serde_json::json!({
        "detections": all,
        "known",
        "new",
        "bbox": {
            "minLat": bounds.min_lat, "maxLat": bounds.max_lat,
            "minLng": bounds.min_lng, "maxLng": bounds.max_lng,
        },
        "zoom": tile_data.zoom,
        "stitched_metadata": {
            "width": tile_data.width,
            "height": tile_data.height,
            "tile_count": tile_data.tile_count,
            "tile_coords": tile_data.tile_coords.iter().map(|c| serde_json::json!({ "x": c.x, "y": c.y, "z": c.z })).collect::<Vec<_>>(),
            "source": tile_data.source,
        },
        "degraded": degraded,
        "error": error,
    });
    Ok(Json(ApiResponse::ok(result)))
}