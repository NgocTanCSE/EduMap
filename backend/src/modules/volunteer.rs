//! Volunteer module — `/api/volunteers/*`: lịch sử hoạt động tình nguyện của
//! người dùng + ghi nhận giờ tình nguyện mới.
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; các
//! endpoint đọc của tình nguyện là JWT):
//!
//! ```text
//! GET  /api/volunteers/activities  -> JWT, lịch sử hoạt động + tổng giờ
//! POST /api/volunteers/activities  -> JWT, ghi nhận giờ tình nguyện mới
//! GET  /api/volunteers             -> public, alias danh sách hoạt động
//! ```
//!
//! Mirrors `backend/src/modules/volunteer/volunteer.controller.ts` +
//! `volunteer.service.ts`.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập (các route của volunteer là JWT).
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

const DB_SELECT_ACTIVITIES: &str = r#"
    SELECT id, title, description, campaign_name, hours, date, status,
           CAST(created_at AS TEXT) AS created_at
    FROM volunteer_activities WHERE volunteer_id = $1
    ORDER BY date DESC
"#;

const DB_SELECT_ALL_ACTIVITIES: &str = r#"
    SELECT id, title, description, campaign_name, hours, date, status,
           CAST(created_at AS TEXT) AS created_at
    FROM volunteer_activities
    ORDER BY date DESC
    LIMIT $1 OFFSET $2
"#;

const DB_INSERT_ACTIVITY: &str = r#"
    INSERT INTO volunteer_activities (volunteer_id, title, description,
                                      campaign_name, hours, date, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    RETURNING id, title, description, campaign_name, hours, date, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SUM_TOTAL_HOURS: &str = r#"
    SELECT COALESCE(SUM(hours), 0) FROM volunteer_activities WHERE volunteer_id = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn activity_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "campaign_name": row.get::<Option<String>>("campaign_name").unwrap_or_default(),
        "hours": row.get::<Option<i64>>("hours").unwrap_or(0),
        "date": row.get::<Option<String>>("date").unwrap_or_default(),
        "status": row.get::<Option<String>>("status").unwrap_or_default(),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct LogActivityForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub campaign_name: Option<String>,
    pub hours: Option<i64>,
    pub date: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct PaginationQuery {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/volunteers/activities` — lịch sử hoạt động tình nguyện + tổng
/// giờ (JWT).
pub async fn get_activities(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_SELECT_ACTIVITIES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let activities: Vec<Value> = rows.iter().map(activity_to_json).collect();

    let total_hours: i64 = sqlx::query_scalar(DB_SUM_TOTAL_HOURS)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "activities": activities,
        "total_hours": total_hours,
    }))))
}

/// `GET /api/volunteers` — alias (public) cho danh sách hoạt động tình nguyện
/// chung.
pub async fn get_volunteers(
    State(pool): State<DbPool>,
    Query(page): Query<PaginationQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = page.page.unwrap_or(1).clamp(1, 100);
    let limit = page.limit.unwrap_or(20).clamp(1, 200);
    let offset = (page - 1) * limit;

    let rows = sqlx::query(DB_SELECT_ALL_ACTIVITIES)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let activities: Vec<Value> = rows.iter().map(activity_to_json).collect();

    Ok(Json(ApiResponse::ok(activities)))
}

/// `POST /api/volunteers/activities` — ghi nhận giờ tình nguyện mới (JWT).
pub async fn log_activity(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<LogActivityForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let hours = match body.hours.as_ref() {
        Some(h) if *h > 0 => h,
        _ => return Err(AppError::BadRequest("Số giờ tình nguyện không hợp lệ.")),
    };

    let title = match body.title.as_deref() {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Err(AppError::BadRequest("Tiêu đề hoạt động không được rỗng.")),
    };

    let date = match body.date.as_deref() {
        Some(d) if !d.trim().is_empty() => d,
        _ => return Err(AppError::BadRequest("Ngày hoạt động không được rỗng.")),
    };

    let inserted_id: String = sqlx::query(DB_INSERT_ACTIVITY)
        .bind(&user.id)
        .bind(title)
        .bind(body.description.as_deref())
        .bind(body.campaign_name.as_deref())
        .bind(hours)
        .bind(date)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String>("id");

    let activity_rows = sqlx::query(DB_SELECT_ACTIVITIES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let activities: Vec<Value> = activity_rows.iter().map(activity_to_json).collect();

    let total_hours: i64 = sqlx::query_scalar(DB_SUM_TOTAL_HOURS)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": format!("Đã ghi nhận {} giờ hoạt động tình nguyện. Chờ hệ thống xác thực.", hours),
        "activity": activities.first().cloned().unwrap_or_default(),
        "current_total": total_hours,
    }))))
}
