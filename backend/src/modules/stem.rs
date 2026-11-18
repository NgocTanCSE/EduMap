//! STEM module — `/api/stem/*`: phòng lab STEM, tìm lab gần nhất (PostGIS),
//! đăng ký lab mới và đặt lịch mượn thiết bị.
//!
//! Mirrors `backend/src/modules/stem/stem.controller.ts` + `stem.service.ts`.
//! Endpoint đọc là public; `POST /stem/labs` và `POST /stem/labs/:id/book`
//! tự kiểm JWT.
//!
//! - `location_point` là `GEOGRAPHY(POINT)` → dùng `ST_DWithin`/`ST_MakePoint`
//!   như trong `map.rs`.
//! - Lịch mượn thiết bị được sinh dưới dạng `booking_ID` duy nhất (old service
//!   làm tương tự) và chống trùng theo cặp người dùng + lab + thiết bị + khung
//!   giờ (giữ trong bộ nhớ, không ghi DB vì bảng này chưa có trong schema).

use crate::common::auth::{AuthUser, authenticated_user};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use std::sync::OnceLock;
use serde::Deserialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct NearbyQuery {
    pub lat: f64,
    pub lng: f64,
    pub radius: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterLab {
    pub name: String,
    pub school_id: Option<String>,
    pub description: Option<String>,
    pub location_point_text: Option<String>,
    pub capacity: Option<i64>,
    pub booking_available: Option<bool>,
    pub photos: Option<Value>,
    pub contact: Option<String>,
    pub equipment: Option<Vec<String>>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BookLab {
    pub equipment_name: String,
    pub start_time: String,
    pub end_time: String,
}

// ---------------------------------------------------------------------------
// In-memory booking store (chống trùng; old service sinh booking_id mà không
// ghi DB).
// ---------------------------------------------------------------------------

/// `created_at` chỉ ghi khi đặt vé, không đọc (chống trùng bằng `entries`).
#[allow(dead_code)]
#[derive(Debug, Clone)]
struct LabBooking {
    lab_id: String,
    user_id: String,
    equipment: String,
    start_time: String,
    end_time: String,
    created_at: String,
}

#[derive(Default)]
struct BookingStore {
    entries: Vec<LabBooking>,
}

static BOOKING_STORE: OnceLock<Arc<Mutex<BookingStore>>> = OnceLock::new();

fn booking_store() -> Arc<Mutex<BookingStore>> {
    BOOKING_STORE
        .get_or_init(|| Arc::new(Mutex::new(BookingStore::default())))
        .clone()
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_LABS: &str = r#"
SELECT id, name, school_id, CAST(location_point AS TEXT) AS location_point,
       description, equipment, location_point_text, capacity,
       booking_available, photos, contact,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM stem_labs
WHERE booking_available IS NOT FALSE
ORDER BY created_at DESC
"#;

const DB_NEARBY: &str = r#"
SELECT id, name, school_id, CAST(location_point AS TEXT) AS location_point,
       description, equipment, location_point_text, capacity,
       booking_available, photos, contact,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at,
       ST_Distance(location_point, ST_MakePoint($1, $2)::geography) AS distance_m
FROM stem_labs
WHERE ST_DWithin(
    location_point,
    ST_MakePoint($1, $2)::geography,
    $3::float8
)
ORDER BY distance_m ASC, created_at DESC
"#;

const DB_LAB_BY_ID: &str = r#"
SELECT id, name, school_id, CAST(location_point AS TEXT) AS location_point,
       description, equipment, location_point_text, capacity,
       booking_available, photos, contact,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM stem_labs WHERE id = $1
"#;



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn equipment_value(equip: Option<Vec<String>>) -> Value {
    equip.map(|v| serde_json::Value::Array(
        v.into_iter().map(|s| serde_json::Value::String(s)).collect()
    )).unwrap_or(serde_json::Value::Array(Vec::new()))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/stem` — thông tin tổng quan module.
pub async fn get_module_info() -> Result<Json<ApiResponse<Value>>, AppError> {
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "module": "stem",
        "description": "Sân chơi STEM — phòng lab và đặt lịch thiết bị",
        "endpoints": vec![
            serde_json::json!({"method": "GET", "path": "/api/stem/labs", "description": "Danh sách phòng lab STEM"}),
            serde_json::json!({"method": "GET", "path": "/api/stem/labs/nearby", "description": "Tìm phòng lab gần nhất"}),
            serde_json::json!({"method": "POST", "path": "/api/stem/labs", "description": "Đăng ký phòng lab mới"}),
            serde_json::json!({"method": "POST", "path": "/api/stem/labs/:id/book", "description": "Đặt lịch mượn thiết bị"}),
        ],
    }))))
}

/// `GET /api/stem/labs` — danh sách phòng lab STEM.
pub async fn get_labs(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = crate::db::query(DB_LABS)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read stem labs: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| row_to_lab_json(&row)).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `GET /api/stem/labs/nearby?lat=&lng=&radius=` — tìm lab gần nhất qua PostGIS.
pub async fn get_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<NearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let radius = q.radius.unwrap_or(10_000.0);
    if radius <= 0.0 || radius > 1_000_000.0 {
        return Err(AppError::BadRequest("radius phải nằm trong khoảng (0, 1_000_000] mét.".to_string()));
    }

    let rows = crate::db::query(DB_NEARBY)
        .bind(q.lng)
        .bind(q.lat)
        .bind(radius)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read nearby labs: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let mut v = row_to_lab_json(&row);
            if let Some(distance) = crate::db::opt_num(&row, "distance_m") {
                v.as_object_mut().unwrap().insert("distanceMeters".to_string(), serde_json::Value::Number(
                    serde_json::Number::from_f64(distance).unwrap_or(serde_json::Number::from(0)),
                ));
            }
            v
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `POST /api/stem/labs` — đăng ký phòng lab mới.
pub async fn register_lab(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<RegisterLab>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name là bắt buộc.".to_string()));
    }

    let location_sql = match (body.latitude, body.longitude) {
        (Some(lat), Some(lng)) => format!("ST_SetSRID(ST_MakePoint({lng:.6}, {lat:.6}), 4326)::geography"),
        _ => return Err(AppError::BadRequest("latitude và longitude là bắt buộc để đăng ký lab.".to_string())),
    };

    let row = crate::db::query(&format!(
        r#"
INSERT INTO stem_labs (name, school_id, location_point, description, equipment,
    location_point_text, capacity, booking_available, photos, contact,
    created_at, updated_at)
VALUES ($1, $2, {location_sql}, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
RETURNING id
"#,
    ))
    .bind(body.name.trim())
    .bind(body.school_id.as_deref())
    .bind(body.description.as_deref().unwrap_or(""))
    .bind(equipment_value(body.equipment.clone()))
    .bind(body.location_point_text.as_deref().unwrap_or(""))
    .bind(body.capacity.unwrap_or(0))
    .bind(body.booking_available.unwrap_or(true))
    .bind(body.photos.as_ref().cloned().unwrap_or(serde_json::Value::Null))
    .bind(body.contact.as_deref().unwrap_or(""))
    .fetch_one(pool.db())
    .await
    .map_err(|e| AppError::Internal(format!("failed to register stem lab: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": crate::db::text(&row, "id") }))))
}

/// `POST /api/stem/labs/:id/book` — đặt lịch mượn thiết bị (chống trùng).
pub async fn book_lab(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(body): Json<BookLab>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let lab = crate::db::query(DB_LAB_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read stem lab: {e}")))?;

    let lab = match lab {
        Some(r) => r,
        None => return Err(AppError::NotFound("Phòng lab không tồn tại.".to_string())),
    };

    if !crate::db::flag(&lab, "booking_available") {
        return Err(AppError::Conflict("Phòng lab này hiện không nhận đặt lịch.".to_string()));
    }

    let start = body.start_time.trim();
    let end = body.end_time.trim();
    if start.is_empty() || end.is_empty() || start >= end {
        return Err(AppError::BadRequest("startTime và endTime hợp lệ (startTime < endTime) là bắt buộc.".to_string()));
    }

    // chống trùng: cùng người dùng + lab + thiết bị + khung giờ trùng lặp
    let store = booking_store();
    let mut locked = store.lock().unwrap();
    let conflict = locked.entries.iter().any(|b| {
        b.lab_id == id && b.user_id == user.id && b.equipment == body.equipment_name
            && !(b.end_time.as_str() <= start || b.start_time.as_str() >= end)
    });
    if conflict {
        return Err(AppError::Conflict(
            "Thiết bị này đã có người đặt trong khung giờ bạn chọn!".to_string(),
        ));
    }

    let booking_id = format!(
        "STEM-BKG-{}-{}-{}",
        &id[..std::cmp::min(8, id.len())].to_uppercase(),
        &user.id[..std::cmp::min(8, user.id.len())].to_uppercase(),
        chrono::Utc::now().timestamp_millis(),
    );

    locked.entries.push(LabBooking {
        lab_id: id.clone(),
        user_id: user.id.clone(),
        equipment: body.equipment_name.clone(),
        start_time: start.to_string(),
        end_time: end.to_string(),
        created_at: now_iso(),
    });

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "booking_id": booking_id,
        "equipment": body.equipment_name,
        "start_time": start,
        "end_time": end,
        "message": format!("Đặt mượn thiết bị {} thành công từ {} đến {}.", body.equipment_name, start, end),
    }))))
}

fn row_to_lab_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "name": crate::db::opt_text(&row, "name"),
        "schoolId": crate::db::opt_text(&row, "school_id"),
        "locationPoint": crate::db::opt_text(&row, "location_point"),
        "description": crate::db::opt_text(&row, "description"),
        "equipment": crate::db::text_list(&row, "equipment"),
        "locationPointText": crate::db::opt_text(&row, "location_point_text"),
        "capacity": crate::db::opt_int(&row, "capacity"),
        "bookingAvailable": crate::db::opt_flag(&row, "booking_available"),
        "photos": crate::db::opt_text(&row, "photos").and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok()),
        "contact": crate::db::opt_text(&row, "contact"),
        "createdAt": crate::db::opt_text(&row, "created_at"),
        "updatedAt": crate::db::opt_text(&row, "updated_at"),
    })
}