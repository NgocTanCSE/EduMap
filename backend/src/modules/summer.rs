//! Summer module — `/api/summer/*`: chiến dịch "Mùa hè xanh" (create/list +
//! đăng ký + báo cáo hoạt động hằng ngày + phê duyệt TNV).
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; các
//! endpoint đọc là public, các handler write tự xác thực và admin/mod được
//! kiểm tra `ensure_admin`):
//!
//! ```text
//! GET  /api/summer/campaigns             -> public, danh sách chiến dịch
//! POST /api/summer/campaigns             -> admin/mod, tạo chiến dịch
//! POST /api/summer/campaigns/:id/activities -> admin/mod, ghi nhận hoạt động
//! GET  /api/summer/campaigns/:id/daily-report -> public, báo cáo hoạt động
//! POST /api/summer/campaigns/:id/register -> JWT, đăng ký tham gia
//! PATCH /api/summer/registrations/:id/status -> admin/mod, phê duyệt/loại
//! ```
//!
//! Mirrors `backend/src/modules/summer/summer.controller.ts` +
//! `summer.service.ts`.

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

/// Người dùng đã đăng nhập (các route đọc của summer là public).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` (tương đương `@Roles(ADMIN, MODERATOR)`).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator" | "super_admin") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_CAMPAIGNS: &str = r#"
    SELECT id, name, year, location, lat, lng, status, description,
           CAST(created_at AS TEXT) AS created_at
    FROM summer_campaigns WHERE status = 'active'
"#;

const DB_SELECT_CAMPAIGN_BY_ID: &str = r#"
    SELECT id, name, year, location, lat, lng, status, description,
           CAST(created_at AS TEXT) AS created_at
    FROM summer_campaigns WHERE id = $1 AND status = 'active'
"#;

const DB_INSERT_CAMPAIGN: &str = r#"
    INSERT INTO summer_campaigns (name, year, location, lat, lng, status, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, name, year, location, lat, lng, status, description,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_INSERT_ACTIVITY: &str = r#"
    INSERT INTO summer_activities (campaign_id, title, description, volunteer_count,
                                   hours_spent, date, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, campaign_id, title, description, volunteer_count,
              hours_spent, date, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_ACTIVITIES_BY_CAMPAIGN_DATE: &str = r#"
    SELECT id, title, volunteer_count, hours_spent, date, status,
           CAST(created_at AS TEXT) AS created_at
    FROM summer_activities
    WHERE campaign_id = $1 AND date = $2
    ORDER BY created_at DESC
"#;

const DB_COUNT_APPROVED_REGISTRATIONS: &str = r#"
    SELECT COUNT(*) FROM summer_registrations
    WHERE campaign_id = $1 AND status = 'approved'
"#;

const DB_INSERT_REGISTRATION: &str = r#"
    INSERT INTO summer_registrations (user_id, campaign_id, status)
    VALUES ($1, $2, 'pending')
    RETURNING id, user_id, campaign_id, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_REGISTRATION_BY_ID: &str = r#"
    SELECT id, campaign_id, status, user_id
    FROM summer_registrations WHERE id = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn campaign_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<Option<String>>("name").unwrap_or_default(),
        "year": row.get::<Option<i64>>("year").unwrap_or(0),
        "location": row.get::<Option<String>>("location").unwrap_or_default(),
        "lat": row.get::<Option<f64>>("lat"),
        "lng": row.get::<Option<f64>>("lng"),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

fn activity_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "campaign_id": row.get::<String>("campaign_id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "volunteer_count": row.get::<Option<i64>>("volunteer_count").unwrap_or(0),
        "hours_spent": row.get::<Option<f64>>("hours_spent").unwrap_or(0.0),
        "date": row.get::<Option<String>>("date").unwrap_or_default(),
        "status": row.get::<Option<String>>("status").unwrap_or_default(),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct DailyReportQuery {
    pub date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampaignForm {
    pub name: Option<String>,
    pub year: Option<i64>,
    pub location: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub description: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
}

fn default_status() -> String {
    "active".to_string()
}

#[derive(Debug, Deserialize)]
pub struct CreateActivityForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub volunteer_count: Option<i64>,
    pub hours_spent: Option<f64>,
    pub date: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterForm {
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/summer/campaigns` — danh sách chiến dịch Mùa hè xanh (public).
pub async fn get_campaigns(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_CAMPAIGNS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let campaigns: Vec<Value> = rows.iter().map(campaign_to_json).collect();

    Ok(Json(ApiResponse::ok(campaigns)))
}

/// `POST /api/summer/campaigns` — tạo chiến dịch mới (admin/mod).
pub async fn create_campaign(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreateCampaignForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let name = match body.name.as_deref() {
        Some(v) if !v.trim().is_empty() => v,
        _ => return Err(AppError::BadRequest("Tên chiến dịch không được rỗng.")),
    };

    let row = sqlx::query(DB_INSERT_CAMPAIGN)
        .bind(name)
        .bind(body.year)
        .bind(body.location.as_deref())
        .bind(body.lat)
        .bind(body.lng)
        .bind(&body.status)
        .bind(body.description.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(campaign_to_json(&row))))
}

/// `POST /api/summer/campaigns/:id/activities` — ghi nhận hoạt động trong ngày
/// của chiến dịch (admin/mod).
pub async fn add_activity(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<CreateActivityForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let campaign = sqlx::query(DB_SELECT_CAMPAIGN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let campaign = match campaign {
        Some(row) => row,
        None => return Err(AppError::NotFound("Chiến dịch Mùa hè xanh không tồn tại.")),
    };

    let title = match body.title.as_deref() {
        Some(v) if !v.trim().is_empty() => v,
        _ => return Err(AppError::BadRequest("Tên hoạt động không được rỗng.")),
    };

    let row = sqlx::query(DB_INSERT_ACTIVITY)
        .bind(&id)
        .bind(title)
        .bind(body.description.as_deref())
        .bind(body.volunteer_count.unwrap_or(0))
        .bind(body.hours_spent.unwrap_or(0.0))
        .bind(body.date.as_deref())
        .bind(body.status.as_deref().unwrap_or("completed"))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(activity_to_json(&row))))
}

/// `GET /api/summer/campaigns/:id/daily-report?date=` — báo cáo hoạt động
/// hằng ngày của chiến dịch (public).
pub async fn get_daily_report(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    Query(q): Query<DailyReportQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let campaign = sqlx::query(DB_SELECT_CAMPAIGN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let campaign = match campaign {
        Some(row) => row,
        None => return Err(AppError::NotFound("Chiến dịch Mùa hè xanh không tồn tại.")),
    };

    let date = match q.date.as_deref() {
        Some(v) if !v.trim().is_empty() => v.to_string(),
        _ => chrono::Utc::now().format("%Y-%m-%d").to_string(),
    };

    let activities = sqlx::query(DB_SELECT_ACTIVITIES_BY_CAMPAIGN_DATE)
        .bind(&id)
        .bind(&date)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(activity_to_json)
        .collect::<Vec<Value>>();

    let total_volunteers_approved: i64 = sqlx::query_scalar(DB_COUNT_APPROVED_REGISTRATIONS)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "campaign_id": campaign.get::<String>("id"),
        "campaign_name": campaign.get::<Option<String>>("name").unwrap_or_default(),
        "location": campaign.get::<Option<String>>("location").unwrap_or_default(),
        "date": date,
        "activities": activities,
        "total_volunteers_approved": total_volunteers_approved,
        "activity_count": activities.len(),
    }))))
}

/// `POST /api/summer/campaigns/:id/register` — đăng ký tham gia chiến dịch
/// (JWT).
pub async fn register_volunteer(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let campaign = sqlx::query(DB_SELECT_CAMPAIGN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let campaign = match campaign {
        Some(row) => row,
        None => return Err(AppError::NotFound("Chiến dịch Mùa hè xanh không tồn tại.")),
    };
    if campaign.get::<String>("status") != "active" {
        return Err(AppError::BadRequest("Chiến dịch đã kết thúc, không thể đăng ký thêm."));
    }

    let existing: Option<i64> = sqlx::query(
        "SELECT 1 FROM summer_registrations WHERE user_id = $1 AND campaign_id = $2",
    )
    .bind(&user.id)
    .bind(&id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?
    .map(|row| row.get::<i64>(0));

    if existing.is_some() {
        return Err(AppError::Conflict("Bạn đã đăng ký tham gia chiến dịch này rồi."));
    }

    let row = sqlx::query(DB_INSERT_REGISTRATION)
        .bind(&user.id)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": format!("Đăng ký tham gia chiến dịch {} thành công!", campaign.get::<Option<String>>("name").unwrap_or_default()),
        "registration": serde_json::json!({
            "id": row.get::<String>("id"),
            "user_id": row.get::<String>("user_id"),
            "campaign_id": row.get::<String>("campaign_id"),
            "status": row.get::<Option<String>>("status").unwrap_or_default(),
            "registered_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        }),
    }))))
}

/// `PATCH /api/summer/registrations/:id/status` — phê duyệt/loại TNV
/// (admin/mod).
pub async fn update_registration_status(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<StatusForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let row = sqlx::query(DB_SELECT_REGISTRATION_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Yêu cầu đăng ký không tồn tại.")),
    };

    let status = match body.status.as_deref() {
        Some("approved") | Some("rejected") => body.status.clone(),
        _ => return Err(AppError::BadRequest("Trạng thái phải là `approved` hoặc `rejected`.")),
    };

    let _ = sqlx::query("UPDATE summer_registrations SET status = $1, updated_at = NOW() WHERE id = $2")
        .bind(&status)
        .bind(&id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "registration": serde_json::json!({
            "id": row.get::<String>("id"),
            "campaign_id": row.get::<String>("campaign_id"),
            "user_id": row.get::<String>("user_id"),
            "status": status.clone(),
        }),
        "message": format!("Cập nhật trạng thái đăng ký thành công: {}.", status.unwrap_or_default()),
    }))))
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct StatusForm {
    pub status: Option<String>,
}
