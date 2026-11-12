//! Events module — `/api/events/*`: danh sách, chi tiết, tạo/cập nhật
//! workshop/sự kiện và đăng ký tham gia (tạo vé + QR).
//!
//! Routing table (applied by `Router::layer(AuthLayer)` in `router.rs`; the
//! list/detail endpoints are listed in `PUBLIC_PATHS` so guests can browse
//! events, the write handlers authenticate themselves and answer 401 when the
//! JWT is missing):
//!
//! ```text
//! GET  /api/events              -> public, danh sách theo start_date ASC
//! GET  /api/events/:id          -> public, chi tiết một sự kiện
//! POST /api/events              -> JWT, tạo sự kiện mới
//! PUT  /api/events/:id          -> JWT, cập nhật thông tin sự kiện (partial)
//! POST /api/events/:id/register -> JWT, đăng ký tham gia + 100 điểm
//! ```
//!
//! Mirrors `backend/src/modules/events/events.controller.ts` +
//! `events.service.ts`. `/api/events` được frontend BFF gọi trực tiếp
//! (`GET /api/events`, `POST /api/events`, `GET /api/events/:id`,
//! `POST /api/events/:id/register`).
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị cấm).
//! PostGIS: `location_point` đọc qua `ST_AsText`, ghi qua
//! `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, Query, State};
use axum::http::Request;
use axum::Json;
use base64::Engine;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use qrcode::QrCode;
use qrcode::render::svg;
use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::{AtomicU32, Ordering};

// ---------------------------------------------------------------------------
// Auth helpers (giống career.rs / community.rs)
// ---------------------------------------------------------------------------

/// The logged-in user: the public event endpoints (`events`, `events/:id`)
/// don't get an `AuthUser` from the router (`PUBLIC_PATHS`), so the write
/// handlers self-check and answer `401` when the JWT is missing.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

/// Escape a single quote so a filter compiled into the SQL text cannot break
/// out of its string literal.
fn esc_sql(v: &str) -> String {
    v.replace('\'', "''")
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/// Parse an optional ISO-8601 / date string into a `DateTime<Utc>` for binding
/// into Postgres `TIMESTAMP WITH TIME ZONE` columns.
fn parse_timestamp(v: &Option<String>) -> Result<Option<DateTime<Utc>>, AppError> {
    let v = match v {
        Some(v) if !v.trim().is_empty() => v.trim(),
        _ => return Ok(None),
    };

    let parsed = chrono::DateTime::parse_from_rfc3339(v)
        .ok()
        .map(|t| t.with_timezone(&Utc))
        .or_else(|| {
            NaiveDate::parse_from_str(v, "%Y-%m-%d")
                .ok()
                .and_then(|d| d.and_hms_opt(0, 0, 0))
                .map(|t| t.and_utc())
        })
        .or_else(|| {
            NaiveDateTime::parse_from_str(v, "%Y-%m-%dT%H:%M:%S%.f%:z")
                .ok()
                .map(|t| t.and_utc())
        })
        .or_else(|| {
            NaiveDateTime::parse_from_str(v, "%Y-%m-%dT%H:%M:%S")
                .ok()
                .map(|t| t.and_utc())
        })
        .or_else(|| {
            NaiveDateTime::parse_from_str(v, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|t| t.and_utc())
        });

    parsed.ok_or_else(|| AppError::BadRequest("Định dạng ngày tháng không hợp lệ".to_string()))
}

// ---------------------------------------------------------------------------
// Location / QR
// ---------------------------------------------------------------------------

/// Tách tọa độ từ body: ưu tiên trường `location` ({lat, lng}), fallback
/// `latitude` / `longitude`. Giữ nguyên hành vi `buildLocation()` của old service.
fn extract_coordinates(
    form: &CreateEventForm,
) -> Result<Option<(f64, f64)>, AppError> {
    if let Some(loc) = form.location.as_ref().filter(|v| v.is_object()) {
        let lat = loc
            .get("lat")
            .and_then(Value::as_f64)
            .or_else(|| loc.get("latitude").and_then(Value::as_f64));
        let lng = loc
            .get("lng")
            .and_then(Value::as_f64)
            .or_else(|| loc.get("longitude").and_then(Value::as_f64));
        match (lat, lng) {
            (Some(lat), Some(lng)) => return Ok(Some((lat, lng))),
            _ => return Err(AppError::BadRequest("Tọa độ location không hợp lệ".to_string())),
        }
    }

    match (form.latitude, form.longitude) {
        (Some(lat), Some(lng)) => Ok(Some((lat, lng))),
        (None, None) => Ok(None),
        _ => Err(AppError::BadRequest("Thiếu tọa độ latitude hoặc longitude".to_string())),
    }
}

/// Tạo mã QR dưới dạng data URL SVG (thay thế `QRCode.toDataURL()` của old
/// service, không cần phụ thuộc bên ngoài).
fn build_qr_data_url(code: &str) -> Result<String, AppError> {
    let qr = QrCode::new(code.as_bytes()).map_err(|e| {
        AppError::Internal(format!("Không thể tạo mã QR: {e}"))
    })?;
    let svg: String = qr.render::<svg::Color>().build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(svg)
    ))
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateEventForm {
    title: String,
    description: String,
    #[serde(rename = "type")]
    r#type: Option<String>,
    longitude: Option<f64>,
    latitude: Option<f64>,
    address: Option<String>,
    start_date: String,
    end_date: String,
    capacity: Option<i64>,
    banner_url: Option<String>,
    organizer_id: Option<String>,
    is_online: Option<bool>,
    meeting_url: Option<String>,
    price: Option<f64>,
    tags: Option<Value>,
    /// { lat, lng } hoặc { latitude, longitude } — giống old DTO.
    location: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UpdateEventForm {
    title: Option<String>,
    description: Option<String>,
    #[serde(rename = "type")]
    r#type: Option<String>,
    longitude: Option<f64>,
    latitude: Option<f64>,
    address: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    capacity: Option<i64>,
    banner_url: Option<String>,
    organizer_id: Option<String>,
    is_online: Option<bool>,
    meeting_url: Option<String>,
    price: Option<f64>,
    tags: Option<Value>,
    location: Option<Value>,
}

/// Bộ đếm phụ cho mã vé, thay thế `Date.now()` của old backend.
static TICKET_SEQUENCE: AtomicU32 = AtomicU32::new(0);

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_EVENTS: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "title", "description", "type",
           ST_AsText("location_point") AS "location_point",
           "address": address,
           CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           "capacity", "registered_count", "banner_url",
           "organizer_id", "status", "price",
           CAST("tags" AS TEXT) AS "tags",
           "is_online", "meeting_url",
           CAST("created_at" AS TEXT) AS "created_at",
           CAST("updated_at" AS TEXT) AS "updated_at"
    FROM "events"
    WHERE "deleted_at" IS NULL
    ORDER BY "start_date" ASC
"#;

const DB_SELECT_EVENT_BY_ID: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "title", "description", "type",
           ST_AsText("location_point") AS "location_point",
           "address": address,
           CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           "capacity", "registered_count", "banner_url",
           "organizer_id", "status", "price",
           CAST("tags" AS TEXT) AS "tags",
           "is_online", "meeting_url",
           CAST("created_at" AS TEXT) AS "created_at",
           CAST("updated_at" AS TEXT) AS "updated_at"
    FROM "events"
    WHERE "id" = $1 AND "deleted_at" IS NULL
"#;

const DB_INSERT_EVENT: &str = r#"
    INSERT INTO "events"
        ("title", "description", "type", "location_point", "address",
         "start_date", "end_date", "capacity", "banner_url",
         "organizer_id", "status", "price", "tags", "is_online",
         "meeting_url", "created_at", "updated_at")
    VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6,
            $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            NOW(), NOW())
    RETURNING CAST("id" AS TEXT) AS "id"
"#;

const DB_UPDATE_EVENT: &str = r#"
    UPDATE "events"
    SET "title" = COALESCE($1, "title"),
        "description" = COALESCE($2, "description"),
        "type" = COALESCE($3, "type"),
        "location_point" = COALESCE(ST_SetSRID(ST_MakePoint($4, $5), 4326), "location_point"),
        "address" = COALESCE($6, "address"),
        "start_date" = COALESCE($7, "start_date"),
        "end_date" = COALESCE($8, "end_date"),
        "capacity" = COALESCE($9, "capacity"),
        "banner_url" = COALESCE($10, "banner_url"),
        "organizer_id" = COALESCE($11, "organizer_id"),
        "status" = COALESCE($12, "status"),
        "price" = COALESCE($13, "price"),
        "tags" = COALESCE($14, "tags"),
        "is_online" = COALESCE($15, "is_online"),
        "meeting_url" = COALESCE($16, "meeting_url"),
        "updated_at" = NOW()
    WHERE "id" = $17
    RETURNING CAST("id" AS TEXT) AS "id", CAST("updated_at" AS TEXT) AS "updated_at"
"#;

const DB_LOCK_EVENT: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "title",
           CAST("start_date" AS TEXT) AS "start_date", "address",
           ST_AsText("location_point") AS "location_point",
           "capacity", "registered_count"
    FROM "events"
    WHERE "id" = $1 AND "deleted_at" IS NULL
    FOR UPDATE
"#;

const DB_EVENT_REGISTRATION: &str = r#"
    INSERT INTO "event_registrations"
        ("event_id", "user_id", "status", "ticket_code", "created_at")
    VALUES ($1, $2, 'registered', $3, NOW())
    RETURNING CAST("id" AS TEXT) AS "id", "ticket_code"
"#;

const DB_INCREMENT_REGISTRATIONS: &str = r#"
    UPDATE "events"
    SET "registered_count" = "registered_count" + $1
    WHERE "id" = $2
"#;

const DB_DOUBLE_REGISTRATION: &str = r#"
    SELECT 1 FROM "event_registrations"
    WHERE "event_id" = $1 AND "user_id" = $2
"#;

const DB_AWARD_POINTS: &str = r#"
    INSERT INTO "user_points"
        ("user_id", "points", "action", "source_type", "source_id", "created_at")
    VALUES ($1, 100, 'EVENT_REGISTRATION', 'event_registration', $2, NOW())
    ON CONFLICT ("user_id", "action", "source_id") DO NOTHING
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn event_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "type": row.get::<Option<String>>("type").unwrap_or_else(|| "workshop".to_string()),
        "location": row.get::<Option<String>>("location_point"),
        "address": row.get::<Option<String>>("address").unwrap_or_default(),
        "start_date": row.get::<Option<String>>("start_date").unwrap_or_default(),
        "end_date": row.get::<Option<String>>("end_date").unwrap_or_default(),
        "capacity": row.get::<Option<i64>>("capacity").unwrap_or(100),
        "registered_count": row.get::<Option<i64>>("registered_count").unwrap_or(0),
        "organizer_id": row.get::<Option<String>>("organizer_id").unwrap_or_default(),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "upcoming".to_string()),
        "image_url": row.get::<Option<String>>("banner_url"),
        "price": row.get::<Option<f64>>("price").unwrap_or(0.0),
        "tags": row.get::<Option<String>>("tags")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "is_online": row.get::<Option<bool>>("is_online").unwrap_or(false),
        "meeting_url": row.get::<Option<String>>("meeting_url"),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        "updated_at": row.get::<Option<String>>("updated_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/events` — lấy danh sách tất cả các workshop/sự kiện (public).
pub async fn get_events(
    State(pool): State<DbPool>,
    Query(_): Query<Value>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_EVENTS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let events: Vec<Value> = rows.iter().map(event_to_json).collect();
    Ok(Json(ApiResponse::ok(events)))
}

/// `GET /api/events/:id` — lấy chi tiết sự kiện theo ID (public).
pub async fn get_event_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_EVENT_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy sự kiện".to_string())),
    };

    Ok(Json(ApiResponse::ok(event_to_json(&row))))
}

/// `POST /api/events` — tạo workshop/sự kiện mới (JWT).
pub async fn create_event(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateEventForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let title = form.title.trim();
    let description = form.description.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("Tên sự kiện là bắt buộc".to_string()));
    }
    if description.is_empty() {
        return Err(AppError::BadRequest("Mô tả sự kiện là bắt buộc".to_string()));
    }

    let start_date = parse_timestamp(&Some(form.start_date))?;
    let end_date = parse_timestamp(&Some(form.end_date))?;
    match (start_date, end_date) {
        (Some(s), Some(e)) if s >= e => {
            return Err(AppError::BadRequest(
                "Ngày kết thúc phải sau ngày bắt đầu".to_string(),
            ));
        }
        (None, _) | (_, None) => {
            return Err(AppError::BadRequest("Ngày bắt đầu và ngày kết thúc là bắt buộc".to_string()));
        }
        _ => {}
    }

    let coords = extract_coordinates(&form)?;

    let inserted = sqlx::query(DB_INSERT_EVENT)
        .bind(title)
        .bind(description)
        .bind(form.r#type.as_deref().unwrap_or("workshop"))
        .bind(coords.map(|c| c.0))
        .bind(coords.map(|c| c.1))
        .bind(form.address.as_deref())
        .bind(start_date)
        .bind(end_date)
        .bind(form.capacity.unwrap_or(100))
        .bind(form.banner_url.as_deref())
        .bind(form.organizer_id.as_deref().filter(|v| !v.is_empty()).unwrap_or(&user.id))
        .bind("upcoming")
        .bind(form.price.unwrap_or(0.0))
        .bind(form.tags.as_ref().map(|v| v.to_string()))
        .bind(form.is_online.unwrap_or(false))
        .bind(form.meeting_url.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let id: String = inserted.get("id");
    let row = sqlx::query(DB_SELECT_EVENT_BY_ID)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(event_to_json(&row))))
}

/// `PUT /api/events/:id` — cập nhật thông tin sự kiện (partial, JWT).
pub async fn update_event(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(form): Json<UpdateEventForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(&req)?;

    if let (Some(s), Some(e)) = (
        parse_timestamp(&form.start_date)?,
        parse_timestamp(&form.end_date)?,
    ) {
        if s >= e {
            return Err(AppError::BadRequest(
                "Ngày kết thúc phải sau ngày bắt đầu".to_string(),
            ));
        }
    }

    let coords = extract_coordinates(&(UpdateEventForm {
        location: form.location.clone(),
        latitude: form.latitude,
        longitude: form.longitude,
        ..Default::default()
    }))?;

    let updated = sqlx::query(DB_UPDATE_EVENT)
        .bind(form.title.as_deref())
        .bind(form.description.as_deref())
        .bind(form.r#type.as_deref())
        .bind(coords.map(|c| c.0))
        .bind(coords.map(|c| c.1))
        .bind(form.address.as_deref())
        .bind(parse_timestamp(&form.start_date)?)
        .bind(parse_timestamp(&form.end_date)?)
        .bind(form.capacity)
        .bind(form.banner_url.as_deref())
        .bind(form.organizer_id.as_deref())
        .bind(form.status.as_deref())
        .bind(form.price)
        .bind(form.tags.as_ref().map(|v| v.to_string()))
        .bind(form.is_online)
        .bind(form.meeting_url.as_deref())
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match updated {
        Some(_) => {}
        None => return Err(AppError::NotFound("Không tìm thấy sự kiện".to_string())),
    }

    let row = sqlx::query(DB_SELECT_EVENT_BY_ID)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(event_to_json(&row))))
}

/// `POST /api/events/:id/register` — đăng ký tham gia workshop (tạo vé),
/// tương đương `EventsService.registerEvent`: khoá hàng (`FOR UPDATE`),
/// kiểm trùng, kiểm chỗ, tăng `registered_count`, ghi vé và cộng 100 điểm.
pub async fn register_event(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let mut tx = match pool.db().begin().await {
        Ok(tx) => tx,
        Err(e) => return Err(AppError::from(e)),
    };

    let event = sqlx::query(DB_LOCK_EVENT)
        .bind(&id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?;

    let event = match event {
        Some(row) => row,
        None => {
            let _ = tx.rollback().await;
            return Err(AppError::NotFound("Không tìm thấy sự kiện".to_string()));
        }
    };

    let duplicate: Option<i64> = sqlx::query(DB_DOUBLE_REGISTRATION)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>(0));

    if duplicate.is_some() {
        let _ = tx.rollback().await;
        return Err(AppError::BadRequest(
            "Bạn đã đăng ký tham gia sự kiện này rồi!".to_string(),
        ));
    }

    let capacity: Option<i64> = event.get("capacity");
    let registered: i64 = event.get("registered_count");
    if registered >= capacity.unwrap_or(i64::MAX) {
        let _ = tx.rollback().await;
        return Err(AppError::BadRequest("Sự kiện/Workshop đã hết chỗ!".to_string()));
    }

    let ticket_code = format!(
        "TICKET-EVT-{}-USR-{}-{}-{:04}",
        id.chars().take(8).collect::<String>().to_uppercase(),
        user.id.chars().take(8).collect::<String>().to_uppercase(),
        Utc::now().timestamp_millis(),
        TICKET_SEQUENCE.fetch_add(1, Ordering::SeqCst) % 10_000
    );

    let reg = sqlx::query(DB_EVENT_REGISTRATION)
        .bind(&id)
        .bind(&user.id)
        .bind(&ticket_code)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::from)?;

    let reg_id: String = reg.get("id");

    sqlx::query(DB_INCREMENT_REGISTRATIONS)
        .bind(1_i64)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

    sqlx::query(DB_AWARD_POINTS)
        .bind(&user.id)
        .bind(&reg_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

    tx.commit().await.map_err(AppError::from)?;

    let qr_url = build_qr_data_url(&ticket_code).unwrap_or_default();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Đăng ký tham gia sự kiện thành công!",
        "event_title": event.get::<Option<String>>("title").unwrap_or_default(),
        "ticket_code": ticket_code,
        "ticket_qr": qr_url,
        "start_date": event.get::<Option<String>>("start_date").unwrap_or_default(),
        "location": event.get::<Option<String>>("location_point"),
        "address": event.get::<Option<String>>("address").unwrap_or_default(),
    }))))
}