//! Wifi module — `/api/wifi/*`: bản đồ phủ sóng Wifi miễn phí (danh sách,
//! tìm lân cận, báo cáo, tốc độ).
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; các
//! endpoint đọc là public):
//!
//! ```text
//! GET  /api/wifi/locations           -> public, danh sách tất cả điểm Wifi
//! GET  /api/wifi/locations/nearby    -> public, điểm Wifi gần nhất (PostGIS)
//! POST /api/wifi/locations           -> JWT, báo cáo chia sẻ điểm Wifi mới
//! POST /api/wifi/locations/:id/speed-test -> JWT, nộp kết quả speed-test
//! ```
//!
//! Mirrors `backend/src/modules/wifi/wifi.controller.ts` + `wifi.service.ts`.
//! Data đích: các trạm Wifi thực tế nằm ở bảng `locations` (`category_id = 6`
//! = `wifi_hotspot`) — bảng rỗng `wifi_locations` không được dùng.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, Query, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập (các route đọc của wifi là public).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

/// Điểm Wifi: `ST_AsGeoJSON(coordinates)` → GeoJSON `{type:"Point", coordinates:[lng,lat]}`
/// + `lat`/`lng` trực tiếp để frontend (Leaflet) đọc. `coordinates` = cfold
/// geojson (cùng shape với `location`).
const DB_SELECT_WIFI_LOCATIONS: &str = r#"
    SELECT l.id, l.name, l.address, l.speed_mbps, l.is_free, l.password,
           l.password_hint, l.verified, l.created_by, l.created_at,
           ST_X(l.coordinates) AS lng, ST_Y(l.coordinates) AS lat,
           ST_AsGeoJSON(l.coordinates::geometry) AS coordinates,
           ST_AsGeoJSON(l.coordinates::geometry) AS location
    FROM locations l
    WHERE l.category_id = 6
    ORDER BY l.created_at DESC
"#;

const DB_SELECT_WIFI_NEARBY: &str = r#"
    SELECT l.id, l.name, l.address, l.speed_mbps, l.is_free, l.password,
           l.password_hint, l.verified, l.created_by, l.created_at,
           ST_X(l.coordinates) AS lng, ST_Y(l.coordinates) AS lat,
           ST_AsGeoJSON(l.coordinates::geometry) AS coordinates,
           ST_AsGeoJSON(l.coordinates::geometry) AS location
    FROM locations l
    WHERE ST_DWithin(l.coordinates, ST_MakePoint($1, $2)::geography, $3)
    AND l.category_id = 6
    ORDER BY l.created_at DESC
    LIMIT $4 OFFSET $5
"#;

const DB_SELECT_WIFI_BY_ID: &str = r#"
    SELECT l.id, l.name, l.address, l.speed_mbps, l.is_free, l.password,
           l.password_hint, l.verified, l.created_by, l.created_at,
           ST_X(l.coordinates) AS lng, ST_Y(l.coordinates) AS lat,
           ST_AsGeoJSON(l.coordinates::geometry) AS coordinates,
           ST_AsGeoJSON(l.coordinates::geometry) AS location
    FROM locations l
    WHERE l.id = $1 AND l.category_id = 6
"#;

const DB_INSERT_WIFI: &str = r#"
    INSERT INTO locations (name, address, category_id, coordinates, speed_mbps,
                           is_free, password, password_hint, verified, created_by,
                           created_at, updated_at)
    VALUES ($1, $2, 6, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8,
            false, $9, NOW(), NOW())
    RETURNING id, name, address, speed_mbps, is_free, password, password_hint,
              verified, created_by, created_at,
              ST_X(coordinates) AS lng, ST_Y(coordinates) AS lat
"#;

const DB_UPDATE_SPEED_TEST: &str = r#"
    UPDATE locations SET rating_avg = ($1 * rating_count + $2) / (rating_count + 1),
                         rating_count = rating_count + 1,
                         updated_at = NOW()
    WHERE id = $3
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

/// Turn a location row into a `locations`-style geography object (GeoJSON +
/// `lat`/`lng`), exactly like the old `Location` entity did.
fn location_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<Option<String>>("name").unwrap_or_default(),
        "address": row.get::<Option<String>>("address").unwrap_or_default(),
        "speed_mbps": row.get::<Option<f64>>("speed_mbps"),
        "is_free": row.get::<Option<bool>>("is_free").unwrap_or(false),
        "password": row.get::<Option<String>>("password").unwrap_or_default(),
        "password_hint": row.get::<Option<String>>("password_hint").unwrap_or_default(),
        "verified": row.get::<Option<bool>>("verified").unwrap_or(false),
        "reported_by": row.get::<Option<String>>("created_by").unwrap_or_default(),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        "lat": row.get::<Option<f64>>("lat"),
        "lng": row.get::<Option<f64>>("lng"),
        "coordinates": row.get::<Option<String>>("coordinates")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "location": row.get::<Option<String>>("location")
            .and_then(|s| serde_json::from_str(&s).ok()),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct NearbyQuery {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius: Option<f64>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ReportForm {
    pub name: Option<String>,
    pub address: Option<String>,
    pub speed_mbps: Option<f64>,
    #[serde(default)]
    pub is_free: bool,
    pub password: Option<String>,
    pub password_hint: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub coordinates: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct SpeedTestForm {
    pub downloadSpeed: Option<f64>,
    pub uploadSpeed: Option<f64>,
    pub rating: Option<f64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/wifi/locations` — danh sách tất cả điểm Wifi phủ sóng công cộng
/// (public).
pub async fn get_wifi_locations(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_WIFI_LOCATIONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let locations: Vec<Value> = rows.iter().map(location_to_json).collect();

    Ok(Json(ApiResponse::ok(locations)))
}

/// `GET /api/wifi/locations/nearby` — các điểm Wifi gần nhất qua PostGIS
/// (`?lat=&lng=&radius=`).
pub async fn get_wifi_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<NearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = match q.lat {
        Some(v) if v.is_finite() => v,
        None => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
    };
    let lng = match q.lng {
        Some(v) if v.is_finite() => v,
        None => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
    };
    let radius = q.radius.unwrap_or(5000.0)
        .clamp(0.0, f64::MAX);

    // `radius` is in meters (ST_DWithin with geography uses meters).
    let limit = q.limit.unwrap_or(300).clamp(1, 500);
    let offset = (q.page.unwrap_or(1) - 1).clamp(0, i64::MAX) * limit;

    let rows = sqlx::query(DB_SELECT_WIFI_NEARBY)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let locations: Vec<Value> = rows.iter().map(location_to_json).collect();

    Ok(Json(ApiResponse::ok(locations)))
}

/// `POST /api/wifi/locations` — báo cáo chia sẻ điểm Wifi miễn phí mới (JWT).
pub async fn report_wifi(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<ReportForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // `latitude`/`longitude` → numeric fallback, `coordinates` → GeoJSON.
    let coordinates = match (body.latitude, body.longitude, body.coordinates) {
        (Some(lat), Some(lng), _) => {
            Some(format!(r#"{{"type":"Point","coordinates":[{},{}]}}"#, lng, lat))
        }
        (_, _, Some(geo)) => Some(serde_json::to_string(&geo).unwrap_or_default()),
        _ => None,
    };

    let coordinates = match coordinates {
        Some(c) if !c.is_empty() => c,
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.")),
    };

    let lat = match coordinates_file_lat(&coordinates) {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.")),
    };
    let lng = match coordinates_file_lng(&coordinates) {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.")),
    };

    let row = sqlx::query(DB_INSERT_WIFI)
        .bind(body.name.as_deref().unwrap_or(""))
        .bind(body.address.as_deref())
        .bind(&lng)
        .bind(&lat)
        .bind(body.speed_mbps)
        .bind(body.is_free)
        .bind(body.password.as_deref())
        .bind(body.password_hint.as_deref())
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "lat": row.get::<Option<f64>>("lat"),
        "lng": row.get::<Option<f64>>("lng"),
        "message": "Đã báo cáo điểm Wifi mới, đang chờ xác minh.",
    }))))
}

/// `POST /api/wifi/locations/:id/speed-test` — nộp kết quả kiểm tra tốc độ
/// Wifi (JWT).
pub async fn submit_speed_test(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<SpeedTestForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(&req)?;

    let rating = match body.rating {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Đánh giá tốc độ phải là số.")),
    };

    let location = sqlx::query(DB_SELECT_WIFI_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let location = match location {
        Some(row) => row,
        None => return Err(AppError::NotFound("Wifi location not found.")),
    };

    let current_avg: f64 = location.get::<Option<f64>>("rating_avg").unwrap_or(0.0);
    let current_count: i64 = location.get::<Option<i64>>("rating_count").unwrap_or(0);
    let new_count = current_count + 1;
    let new_avg = (current_avg * current_count + rating) / new_count as f64;

    sqlx::query(DB_UPDATE_SPEED_TEST)
        .bind(&new_avg)
        .bind(&rating)
        .bind(&id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Kết quả kiểm tra tốc độ đã được lưu",
        "location_id": id,
        "download_mbps": body.downloadSpeed,
        "upload_mbps": body.uploadSpeed,
        "rating": rating,
        "updated_rating_avg": (new_avg * 100.0).round() / 100.0,
        "updated_rating_count": new_count,
    }))))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the lng lat from a GeoJSON text body.
fn coordinates_file_lat(geo: &str) -> Option<f64> {
    let parsed: Result<Value, _> = serde_json::from_str(geo);
    match parsed {
        Ok(Value::Object(map)) => map.get("coordinates")
            .and_then(|v| v.as_array())
            .and_then(|a| a.get(1).and_then(Value::as_f64)),
        _ => None,
    }
}

fn coordinates_file_lng(geo: &str) -> Option<f64> {
    let parsed: Result<Value, _> = serde_json::from_str(geo);
    match parsed {
        Ok(Value::Object(map)) => map.get("coordinates")
            .and_then(|v| v.as_array())
            .and_then(|a| a.get(0).and_then(Value::as_f64)),
        _ => None,
    }
}
