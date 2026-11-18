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

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


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
fn location_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "name": crate::db::opt_text(&row, "name").unwrap_or_default(),
        "address": crate::db::opt_text(&row, "address").unwrap_or_default(),
        "speed_mbps": crate::db::opt_num(&row, "speed_mbps"),
        "is_free": crate::db::opt_flag(&row, "is_free").unwrap_or(false),
        "password": crate::db::opt_text(&row, "password").unwrap_or_default(),
        "password_hint": crate::db::opt_text(&row, "password_hint").unwrap_or_default(),
        "verified": crate::db::opt_flag(&row, "verified").unwrap_or(false),
        "reported_by": crate::db::opt_text(&row, "created_by").unwrap_or_default(),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
        "lat": crate::db::opt_num(&row, "lat"),
        "lng": crate::db::opt_num(&row, "lng"),
        "coordinates": crate::db::opt_text(&row, "coordinates")
            .and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "location": crate::db::opt_text(&row, "location")
            .and_then(|s| serde_json::from_str::<Value>(&s).ok()),
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

/// `downloadSpeed`/`uploadSpeed` giữ lại để khách gửi kèm (không đọc).
#[allow(dead_code)]
#[allow(non_snake_case)]
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
    let rows = crate::db::query(DB_SELECT_WIFI_LOCATIONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let locations: Vec<Value> = rows.iter().map(location_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::Value::Array(locations))))
}

/// `GET /api/wifi/locations/nearby` — các điểm Wifi gần nhất qua PostGIS
/// (`?lat=&lng=&radius=`).
pub async fn get_wifi_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<NearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = match q.lat {
        Some(v) if v.is_finite() => v,
        Some(_) => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
        None => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
    };
    let lng = match q.lng {
        Some(v) if v.is_finite() => v,
        Some(_) => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
        None => return Err(AppError::BadRequest(
            "Toạ độ không hợp lệ: cần lat và lng là số.".to_string(),
        )),
    };
    let radius = q.radius.unwrap_or(5000.0)
        .clamp(0.0, f64::MAX);

    // `radius` is in meters (ST_DWithin with geography uses meters).
    let limit = q.limit.unwrap_or(300).clamp(1, 500);
    let offset = (q.page.unwrap_or(1) - 1).clamp(0, i64::MAX) * limit;

    let rows = crate::db::query(DB_SELECT_WIFI_NEARBY)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let locations: Vec<Value> = rows.iter().map(location_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::Value::Array(locations))))
}

/// `POST /api/wifi/locations` — báo cáo chia sẻ điểm Wifi miễn phí mới (JWT).
pub async fn report_wifi(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<ReportForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

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
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.".to_string())),
    };

    let lat = match coordinates_file_lat(&coordinates) {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.".to_string())),
    };
    let lng = match coordinates_file_lng(&coordinates) {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Toạ độ điểm Wifi là bắt buộc.".to_string())),
    };

    let row = crate::db::query(DB_INSERT_WIFI)
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
        "id": crate::db::text(&row, "id"),
        "lat": crate::db::opt_num(&row, "lat"),
        "lng": crate::db::opt_num(&row, "lng"),
        "message": "Đã báo cáo điểm Wifi mới, đang chờ xác minh.",
    }))))
}

/// `POST /api/wifi/locations/:id/speed-test` — nộp kết quả kiểm tra tốc độ
/// Wifi (JWT).
pub async fn submit_speed_test(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(body): Json<SpeedTestForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;

    let rating = match body.rating {
        Some(v) if v.is_finite() => v,
        _ => return Err(AppError::BadRequest("Đánh giá tốc độ phải là số.".to_string())),
    };

    let location = crate::db::query(DB_SELECT_WIFI_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let location = match location {
        Some(row) => row,
        None => return Err(AppError::NotFound("Wifi location not found.".to_string())),
    };

    let current_avg: f64 = crate::db::opt_num(&location, "rating_avg").unwrap_or(0.0);
    let current_count: i64 = crate::db::opt_int(&location, "rating_count").unwrap_or(0);
    let new_count = current_count + 1;
    let new_avg = (current_avg * current_count as f64 + rating) / (new_count as f64);

    crate::db::query(DB_UPDATE_SPEED_TEST)
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
