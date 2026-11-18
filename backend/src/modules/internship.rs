//! Internship module — `/api/internships/*`: danh sách, chi tiết, tìm kiếm
//! vị trí thực tập thường ngày (PostGIS), tạo cơ hội thực tập (chỉ doanh
//! nghiệp) và ứng tuyển.
//!
//! Mirrors `backend/src/modules/internship/internship.controller.ts` +
//! `internship.service.ts`.
//! - `internships.company_id` -> `organizations.id` (join lấy tên + avatar).
//! - `internships.location_point` là `GEOGRAPHY(POINT)` — đọc qua
//!   `ST_AsText()`, ghi qua `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)`.
//! - `internship_applications.tracking_id` UNIQUE (trùng khóa -> `409`),
//!   ứng tuyển phải `status = 'open' + chưa có hồ sơ`.
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).
//! Postgres/PostGIS only.

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
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct InternshipListQuery {
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InternshipNearbyQuery {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius: Option<f64>,
}

/// `status` giữ lại để khách gửi kèm (không đọc).
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct CreateInternshipForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub field: Option<String>,
    pub salary_range: Option<String>,
    pub deadline: Option<String>,
    pub duration: Option<String>,
    pub requirements: Option<String>,
    pub benefits: Option<String>,
    pub status: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

/// `coverLetter` giữ lại để khách gửi kèm (không đọc).
#[allow(dead_code)]
#[allow(non_snake_case)]
#[derive(Debug, Clone, Deserialize)]
pub struct ApplyForm {
    pub coverLetter: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_LIST_BASE: &str = r#"
    SELECT i.id, i.title, i.description, i.field, i.salary_range, i.duration,
           i.requirements, i.benefits, i.deadline, i.application_count,
           i.status, i.created_at, i.updated_at,
           ST_AsText(i.location_point) AS location_point,
           o.id AS org_id, o.name AS org_name, o.logo_url AS org_logo_url
    FROM internships i
    LEFT JOIN organizations o ON o.id = i.company_id
    WHERE (i.status = 'open' OR i.status = 'draft')
    ORDER BY i.created_at DESC
    LIMIT $1 OFFSET $2
"#;

const DB_SELECT_COUNT_BASE: &str = r#"
    SELECT COUNT(*) AS total
    FROM internships i
    WHERE (i.status = 'open' OR i.status = 'draft')
"#;

const DB_SELECT_DETAIL: &str = r#"
    SELECT i.id, i.title, i.description, i.field, i.salary_range, i.duration,
           i.requirements, i.benefits, i.deadline, i.application_count,
           i.status, i.created_at, i.updated_at,
           ST_AsText(i.location_point) AS location_point,
           o.id AS org_id, o.name AS org_name, o.logo_url AS org_logo_url
    FROM internships i
    LEFT JOIN organizations o ON o.id = i.company_id
    WHERE i.id = $1
"#;

const DB_SELECT_NEARBY_BASE: &str = r#"
    SELECT i.id, i.title, i.description, i.field, i.salary_range, i.duration,
           i.requirements, i.benefits, i.deadline, i.application_count,
           i.status, i.created_at, i.updated_at,
           ST_AsText(i.location_point) AS location_point,
           o.id AS org_id, o.name AS org_name, o.logo_url AS org_logo_url
    FROM internships i
    LEFT JOIN organizations o ON o.id = i.company_id
    WHERE i.location_point IS NOT NULL
      AND ST_DWithin(i.location_point,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
    ORDER BY i.created_at DESC
    LIMIT $4 OFFSET $5
"#;

const DB_INSERT_INTERNSHIP: &str = r#"
    INSERT INTO internships (title, description, field, company_id, location_point,
                             salary_range, duration, requirements, benefits, deadline,
                             status, created_at, updated_at)
    VALUES ($1,$2,$3,$4::uuid,ST_SetSRID(ST_MakePoint($5, $6), 4326),$7,$8,$9,$10,$11,'open',NOW(),NOW())
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_INSERT_APPLICATION: &str = r#"
    INSERT INTO internship_applications (user_id, internship_id, cover_letter,
                                         status, tracking_id, created_at)
    VALUES ($1::uuid,$2::uuid,$3,'reviewing',$4,NOW())
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_EXISTING_APPLICATION: &str = r#"
    SELECT id FROM internship_applications
    WHERE user_id = $1::uuid AND internship_id = $2::uuid
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

/// Parse a PostGIS `POINT (lng, lat)` text representation into `[lat, lng]`.
fn parse_point_text(text: &str) -> Option<[f64; 2]> {
    let text = text.trim();
    let text = text.trim_start_matches("POINT(");
    let text = text.trim_end_matches(")");
    let tokens: Vec<&str> = text
        .split(' ')
        .filter(|t| !t.is_empty())
        .collect();
    if tokens.len() != 2 {
        return None;
    }
    let lng = tokens[0].parse::<f64>().ok();
    let lat = tokens[1].parse::<f64>().ok();
    match (lng, lat) {
        (Some(lng), Some(lat)) => Some([lat, lng]),
        _ => None,
    }
}

/// Build the JSON for one internship row.
///
/// `location_point` is a PostGIS `GEOGRAPHY(POINT)` — `ST_AsText()` emits
/// `POINT (lng lat)`, so the first coordinate is the longitude.
fn row_to_json(row: &sqlx::postgres::PgRow) -> Value {
    let location = crate::db::opt_text(&row, "location_point")
        .and_then(|s| parse_point_text(&s));

    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "title": crate::db::text(&row, "title"),
        "description": crate::db::opt_text(&row, "description"),
        "field": crate::db::opt_text(&row, "field"),
        "salary_range": crate::db::opt_text(&row, "salary_range"),
        "duration": crate::db::opt_text(&row, "duration"),
        "requirements": crate::db::opt_text(&row, "requirements"),
        "benefits": crate::db::opt_text(&row, "benefits"),
        "deadline": crate::db::opt_text(&row, "deadline"),
        "status": crate::db::text(&row, "status"),
        "application_count": crate::db::int(&row, "application_count"),
        "created_at": crate::db::opt_text(&row, "created_at"),
        "updated_at": crate::db::opt_text(&row, "updated_at"),
        "company": {
            "id": crate::db::opt_text(&row, "org_id"),
            "full_name": crate::db::opt_text(&row, "org_name"),
            "avatar_url": crate::db::opt_text(&row, "org_logo_url"),
        },
        "location": location,
    })
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/// Chuyển `sqlx::Error` sang `AppError`, biến đổi unique-violation (23505)
// thành `Conflict` để frontend nhận được thông điệp rõ thay vì 500.
fn to_app_error(e: sqlx::Error) -> AppError {
    if let Some(db_err) = e.as_database_error() {
        if db_err.code().map_or(false, |c| c == "23505") {
            return AppError::Conflict("Dữ liệu đã tồn tại (trùng khóa duy nhất).".to_string());
        }
    }
    AppError::from(e)
}


// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/internships` — danh sách vị trí đang mở, phân trang.
pub async fn get_internships(
    State(pool): State<DbPool>,
    Query(q): Query<InternshipListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or_else(|| "1".to_string()).parse::<i64>().unwrap_or(1).max(1);
    let limit = q.limit.as_deref().unwrap_or("10").parse::<i64>().unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * limit;

    let rows = crate::db::query(DB_SELECT_LIST_BASE)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;

    let total = crate::db::query(DB_SELECT_COUNT_BASE)
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?
        .get::<i64, &str>("total");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(|r| row_to_json(&r)).collect::<Vec<_>>(),
        "meta": {
            "totalItems": total,
            "itemsPerPage": limit,
            "totalPages": ((total as f64 / limit as f64).ceil() as i64).max(1),
            "currentPage": page,
        },
    }))))
}

/// `GET /api/internships/nearby` — tìm vị trí thực tập theo bán kính (PostGIS).
pub async fn get_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<InternshipNearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = q.lat.unwrap_or(10.9);
    let lng = q.lng.unwrap_or(106.8);
    let radius = q.radius.unwrap_or(10000.0) * 1000.0;
    let limit: i64 = 50;
    let offset: i64 = 0;

    let rows = crate::db::query(DB_SELECT_NEARBY_BASE)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(|r| row_to_json(&r)).collect::<Vec<_>>(),
        "center": {
            "lat": lat,
            "lng": lng,
        },
        "radius_m": radius,
    }))))
}

/// `GET /api/internships/:id` — chi tiết vị trí thực tập.
pub async fn get_internship_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_SELECT_DETAIL)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "internship": row_to_json(&r),
        })))),
        None => Err(AppError::NotFound(
            "Không tìm thấy cơ hội thực tập này.".to_string(),
        )),
    }
}

/// `POST /api/internships` — đăng tuyển (chỉ doanh nghiệp / JWT).
pub async fn create_internship(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(form): Json<CreateInternshipForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    if form.title.is_none() || form.description.is_none() || form.field.is_none() {
        return Err(AppError::BadRequest(
            "Vui lòng điền đầy đủ tiêu đề, mô tả và lĩnh vực.".to_string(),
        ));
    }

    let row = crate::db::query(DB_INSERT_INTERNSHIP)
        .bind(form.title.as_deref().unwrap())
        .bind(form.description.as_deref().unwrap())
        .bind(form.field.as_deref().unwrap())
        .bind(&user.id)
        .bind(form.latitude)
        .bind(form.longitude)
        .bind(form.salary_range.as_deref())
        .bind(form.duration.as_deref())
        .bind(form.requirements.as_deref())
        .bind(form.benefits.as_deref())
        .bind(form.deadline.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "internship": {
            "id": crate::db::text(&row, "id"),
        },
    }))))
}

/// `POST /api/internships/:id/apply` — nộp hồ sơ ứng tuyển thực tập.
pub async fn apply_internship(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(form): Json<ApplyForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let cover_letter: String = form.coverLetter.unwrap_or_default().trim().to_string();

    let row = crate::db::query(DB_SELECT_DETAIL)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => {
            if crate::db::text(&r, "status") != "open" {
                return Err(AppError::BadRequest(
                    "Vị trí thực tập này đã đóng đăng ký.".to_string(),
                ));
            }

            let existing = crate::db::query(DB_SELECT_EXISTING_APPLICATION)
                .bind(&user.id)
                .bind(&id)
                .fetch_optional(pool.db())
                .await
                .map_err(to_app_error)?;

            if let Some(_) = existing {
                return Err(AppError::Conflict(
                    "Bạn đã nộp đơn ứng tuyển cho vị trí này rồi. Hãy chờ phản hồi từ nhà tuyển dụng.".to_string(),
                ));
            }

            let tracking_id = format!("INT-APPLY-{}-{}-{}",
                id[0..8].to_uppercase().trim(),
                user.id[0..8].to_uppercase().trim(),
                chrono::Utc::now().timestamp_millis());

            crate::db::query(DB_INSERT_APPLICATION)
                .bind(&user.id)
                .bind(&id)
                .bind(&cover_letter)
                .bind(&tracking_id)
                .execute(pool.db())
                .await
                .map_err(to_app_error)?;

            Ok(Json(ApiResponse::ok(serde_json::json!({
                "success": true,
                "tracking_id": tracking_id,
                "status": "reviewing",
                "message": "Nộp hồ sơ ứng tuyển thực tập thành công! Nhà tuyển dụng sẽ xem xét hồ sơ của bạn.",
            }))))
        }
        None => Err(AppError::NotFound(
            "Không tìm thấy cơ hội thực tập này.".to_string(),
        )),
    }
}
