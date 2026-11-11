//! International module — `/api/intl/*`: chương trình trao đổi/học bổng quốc
//! tế (`programs`) + mạng lưới lưu học sinh Việt Nam (`alumni`).
//!
//! Mirrors `backend/src/modules/intl/intl.controller.ts` + `intl.service.ts`:
//! - `international_programs` (id UUID, title, type, description, host_country,
//!   organization, application_deadline, benefits JSONB, apply_url).
//! - `alumni_networks` (id UUID, full_name, university, country, major,
//!   location GEOGRAPHY(POINT), contact_email, status, created_at).
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).
//! Postgres/PostGIS only.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ProgramListQuery {
    #[serde(rename = "type")]
    pub resource_type: Option<String>,
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProgramForm {
    pub title: String,
    #[serde(rename = "type")]
    pub resource_type: String,
    pub description: Option<String>,
    pub host_country: Option<String>,
    pub organization: Option<String>,
    pub application_deadline: Option<String>,
    pub benefits: Option<String>,
    pub apply_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AlumniListQuery {
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AlumniNearbyQuery {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub radius: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateAlumniForm {
    pub full_name: String,
    pub university: String,
    pub country: String,
    pub major: String,
    pub latitude: f64,
    pub longitude: f64,
    pub contact_email: Option<String>,
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_PROGRAMS: &str = r#"
    SELECT id, title, type, description, host_country, organization,
           CAST(application_deadline AS TEXT) AS application_deadline,
           benefits, apply_url, CAST(created_at AS TEXT) AS created_at
    FROM international_programs
    {where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
"#;

const DB_SELECT_PROGRAMS_COUNT: &str = r#"
    SELECT COUNT(*) AS total
    FROM international_programs
    {where}
"#;

const DB_SELECT_PROGRAM_BY_ID: &str = r#"
    SELECT id, title, type, description, host_country, organization,
           CAST(application_deadline AS TEXT) AS application_deadline,
           benefits, apply_url, CAST(created_at AS TEXT) AS created_at
    FROM international_programs
    WHERE id = $1
"#;

const DB_INSERT_PROGRAM: &str = r#"
    INSERT INTO international_programs (title, type, description, host_country,
                                        organization, application_deadline, benefits, apply_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, title, type, description, host_country, organization,
              CAST(application_deadline AS TEXT) AS application_deadline,
              benefits, apply_url, CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_ALUMNI: &str = r#"
    SELECT id, full_name, university, country, major,
           ST_AsText(location) AS location_point, contact_email, status,
           CAST(created_at AS TEXT) AS created_at
    FROM alumni_networks
    {where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
"#;

const DB_SELECT_ALUMNI_NEARBY: &str = r#"
    SELECT id, full_name, university, country, major,
           ST_AsText(location) AS location_point, contact_email, status,
           CAST(created_at AS TEXT) AS created_at
    FROM alumni_networks
    WHERE location IS NOT NULL
      AND ST_DWithin(location,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
    ORDER BY created_at DESC
    LIMIT $4 OFFSET $5
"#;

const DB_INSERT_ALUMNI: &str = r#"
    INSERT INTO alumni_networks (full_name, university, country, major,
                                 location, contact_email, status, created_at)
    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, NOW())
    RETURNING id, full_name, university, country, major,
              ST_AsText(location) AS location_point, contact_email, status,
              CAST(created_at AS TEXT) AS created_at
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

/// Parse a PostGIS `POINT (lng, lat)` text representation into a GeoJSON
/// `Point` with `[lng, lat]` coordinates (the shape the frontend reads).
fn point_to_geojson(text: Option<&str>) -> Option<Value> {
    let text = text?;
    let text = text.trim().trim_start_matches("POINT(").trim_end_matches(')');
    let tokens: Vec<&str> = text.split(' ').filter(|t| !t.is_empty()).collect();
    if tokens.len() != 2 {
        return None;
    }
    let lng = tokens[0].parse::<f64>().ok()?;
    let lat = tokens[1].parse::<f64>().ok()?;
    Some(serde_json::json!({
        "type": "Point",
        "coordinates": [lng, lat],
    }))
}

fn program_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<String>("title"),
        "type": row.get::<String>("type"),
        "description": row.get::<Option<String>, _>("description"),
        "host_country": row.get::<Option<String>, _>("host_country"),
        "organization": row.get::<Option<String>, _>("organization"),
        "application_deadline": row.get::<Option<String>, _>("application_deadline"),
        "benefits": row.get::<Option<String>, _>("benefits"),
        "apply_url": row.get::<Option<String>, _>("apply_url"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn alumni_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "full_name": row.get::<String>("full_name"),
        "university": row.get::<String>("university"),
        "country": row.get::<String>("country"),
        "major": row.get::<String>("major"),
        "location": point_to_geojson(row.get::<Option<String>, _>("location_point").as_deref()),
        "contact_email": row.get::<Option<String>, _>("contact_email"),
        "status": row.get::<String>("status"),
        "created_at": row.get::<String>("created_at"),
    })
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/// `admin` / `moderator` (tương đương `@Roles(ADMIN, MODERATOR)` của old
/// backend).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/intl/programs` — danh sách chương trình quốc tế (công khai);
/// `?type=` lọc theo loại, `page`/`limit` phân trang.
pub async fn get_programs(
    State(pool): State<DbPool>,
    Query(q): Query<ProgramListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or("1").parse::<i64>().unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or("50").parse::<i64>().unwrap_or(50).max(1).min(200);
    let offset = (page - 1) * limit;

    let mut where_clauses = Vec::new();
    if let Some(ty) = q.resource_type.as_ref().filter(|v| !v.trim().is_empty()) {
        where_clauses.push(format!("type = '{}'", ty.replace('\'', "''")));
    }
    let where_clause = where_clauses.join(" AND ");
    let where_clause = if where_clause.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clause)
    };

    let rows = sqlx::query(DB_SELECT_PROGRAMS.replace("{where}", &where_clause).as_str())
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let total = sqlx::query(DB_SELECT_PROGRAMS_COUNT.replace("{where}", &where_clause).as_str())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>("total");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(program_to_json).collect::<Vec<_>>(),
        "meta": {
            "totalItems": total,
            "itemsPerPage": limit,
            "totalPages": ((total as f64 / limit as f64).ceil() as i64).max(1),
            "currentPage": page,
        },
    }))))
}

/// `POST /api/intl/programs` — đăng ký chương trình quốc tế mới (admin).
pub async fn create_program(
    State(pool): State<DbPool>,
    req: axum::http::Request,
    Json(form): Json<CreateProgramForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let benefits = form.benefits
        .as_deref()
        .filter(|v| !v.trim().is_empty())
        .map(|v| if v.starts_with('[') { v.to_string() } else { format!("['{}']", v.replace('\'', "''")) });

    let row = sqlx::query(DB_INSERT_PROGRAM)
        .bind(&form.title)
        .bind(&form.resource_type)
        .bind(form.description.as_deref())
        .bind(form.host_country.as_deref())
        .bind(form.organization.as_deref())
        .bind(form.application_deadline.as_deref())
        .bind(benefits.as_deref())
        .bind(form.apply_url.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "program": program_to_json(&row),
    }))))
}

/// `GET /api/intl/alumni` — danh sách lưu học sinh (công khai).
pub async fn get_alumni(
    State(pool): State<DbPool>,
    Query(q): Query<AlumniListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or("1").parse::<i64>().unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or("50").parse::<i64>().unwrap_or(50).max(1).min(200);
    let offset = (page - 1) * limit;

    let rows = sqlx::query(DB_SELECT_ALUMNI.replace("{where}", ""))
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(alumni_to_json).collect::<Vec<_>>(),
        "meta": {
            "totalItems": rows.len() as i64,
            "itemsPerPage": limit,
            "totalPages": 1,
            "currentPage": page,
        },
    }))))
}

/// `POST /api/intl/alumni` — đăng ký mạng lưới lưu học sinh (JWT).
pub async fn create_alumni(
    State(pool): State<DbPool>,
    req: axum::http::Request,
    Json(form): Json<CreateAlumniForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.full_name.trim().is_empty() || form.university.trim().is_empty()
        || form.country.trim().is_empty() || form.major.trim().is_empty()
        || form.latitude.is_nan() || form.longitude.is_nan()
    {
        return Err(AppError::BadRequest(
            "Vui lòng điền đầy đủ họ tên, trường đại học, quốc gia, chuyên ngành và tọa độ.".to_string(),
        ));
    }

    let row = sqlx::query(DB_INSERT_ALUMNI)
        .bind(&form.full_name)
        .bind(&form.university)
        .bind(&form.country)
        .bind(&form.major)
        .bind(&form.longitude)
        .bind(&form.latitude)
        .bind(form.contact_email.as_deref())
        .bind(form.status.as_deref().unwrap_or("studying"))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "alumni": alumni_to_json(&row),
    }))))
}

/// `GET /api/intl/alumni/nearby` — lưu học sinh gần một tọa độ (PostGIS).
pub async fn get_alumni_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<AlumniNearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = q.latitude.unwrap_or(10.8);
    let lng = q.longitude.unwrap_or(106.7);
    let radius = q.radius.unwrap_or(50000.0);
    let limit: i64 = 100;
    let offset: i64 = 0;

    let rows = sqlx::query(DB_SELECT_ALUMNI_NEARBY)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(alumni_to_json).collect::<Vec<_>>(),
        "center": {
            "lat": lat,
            "lng": lng,
        },
        "radius_m": radius,
    }))))
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các endpoint đọc của intl là public (danh sách
/// chương trình, danh sách và bản đồ lưu học sinh); các handler write giữ
/// JWT (`@UseGuards(JwtAuthGuard)` cũ) và trả `401` khi thiếu token.
fn authenticated_user(req: &axum::http::Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}
