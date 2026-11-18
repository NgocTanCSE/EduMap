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

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


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
    RETURNING id::text AS id, title, description, campaign_name, hours, date, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SUM_TOTAL_HOURS: &str = r#"
    SELECT COALESCE(SUM(hours), 0) FROM volunteer_activities WHERE volunteer_id = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn activity_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "title": crate::db::opt_text(&row, "title").unwrap_or_default(),
        "description": crate::db::opt_text(&row, "description").unwrap_or_default(),
        "campaign_name": crate::db::opt_text(&row, "campaign_name").unwrap_or_default(),
        "hours": row.get::<Option<i64>, &str>("hours").unwrap_or(0),
        "date": crate::db::opt_text(&row, "date").unwrap_or_default(),
        "status": crate::db::opt_text(&row, "status").unwrap_or_default(),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
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
    user: Option<Extension<AuthUser>>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let rows = crate::db::query(DB_SELECT_ACTIVITIES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let activities: Vec<Value> = rows.iter().map(activity_to_json).collect();

    let total_hours: i64 = crate::db::query(DB_SUM_TOTAL_HOURS)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64, _>(0);

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
    let current_page = page.page.unwrap_or(1).clamp(1, 100);
    let limit = page.limit.unwrap_or(20).clamp(1, 200);
    let offset = (current_page - 1) * limit;

    let rows = crate::db::query(DB_SELECT_ALL_ACTIVITIES)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let activities: Vec<Value> = rows.iter().map(activity_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::Value::Array(activities))))
}

/// `POST /api/volunteers/activities` — ghi nhận giờ tình nguyện mới (JWT).
pub async fn log_activity(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<LogActivityForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let hours = match body.hours.as_ref() {
        Some(h) if *h > 0 => h,
        _ => return Err(AppError::BadRequest("Số giờ tình nguyện không hợp lệ.".to_string())),
    };

    let title = match body.title.as_deref() {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Err(AppError::BadRequest("Tiêu đề hoạt động không được rỗng.".to_string())),
    };

    let date = match body.date.as_deref() {
        Some(d) if !d.trim().is_empty() => d,
        _ => return Err(AppError::BadRequest("Ngày hoạt động không được rỗng.".to_string())),
    };

    let _inserted_id: String = crate::db::query(DB_INSERT_ACTIVITY)
        .bind(&user.id)
        .bind(title)
        .bind(body.description.as_deref())
        .bind(body.campaign_name.as_deref())
        .bind(hours)
        .bind(date)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String, &str>("id");

    let activity_rows = crate::db::query(DB_SELECT_ACTIVITIES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let activities: Vec<Value> = activity_rows.iter().map(activity_to_json).collect();

    let total_hours: i64 = crate::db::query(DB_SUM_TOTAL_HOURS)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64, _>(0);

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": format!("Đã ghi nhận {} giờ hoạt động tình nguyện. Chờ hệ thống xác thực.", hours),
        "activity": activities.first().cloned().unwrap_or_default(),
        "current_total": total_hours,
    }))))
}
