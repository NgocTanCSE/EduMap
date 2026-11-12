//! Admin module — `/api/admin/*`: dashboard stats, user management (list,
//! detail, status changes, soft-delete/restore), pending content review,
//! data-quality report, question-gaps report and auto-scheduler health.
//!
//! Mirrors `backend/src/modules/admin/admin.controller.ts` +
//! `admin.service.ts`. Every route requires the `admin`/`moderator` role
//! (`@Roles(ADMIN, MODERATOR)` in the old backend) — the `AuthLayer` inserts
//! an `AuthUser` and this module checks the role itself.
//!
//! All SQL uses the runtime API (`query!` requires a live DB at compile time).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::{proxy_get_aiservice, proxy_to_ai_service};
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::{Deserialize, Serialize};

/// The logged-in user: `/api/admin` is behind `@UseGuards(JwtAuthGuard,
/// RolesGuard)` (the old backend), so the handlers self-check and answer `401`
/// when the JWT is missing.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` only (`@Roles(ADMIN, MODERATOR)` in the old backend —
/// any other role gets a `403` like the old backend's access denied).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

/// `GET /api/admin/dashboard` — the summary stats (all counters in one query).
const DB_SELECT_STATS: &str = r#"
    SELECT (SELECT COUNT(*) FROM users) AS total_users,
           (SELECT COUNT(*) FROM donation_campaigns WHERE status = 'active') AS active_campaigns,
           (SELECT COUNT(*) FROM scholarships WHERE deleted_at IS NULL) AS total_scholarships,
           (SELECT COUNT(*) FROM events WHERE status = 'upcoming') AS upcoming_events,
           (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_user_verifications,
           (SELECT COUNT(*) FROM donation_campaigns WHERE status = 'pending') AS pending_campaign_approvals,
           (SELECT COUNT(*) FROM scholarships WHERE status = 'pending') AS pending_scholarship_approvals,
           (SELECT COUNT(*) FROM events WHERE status = 'pending') AS pending_event_approvals
"#;

/// `SELECT id, email, full_name, role, status, created_at, last_login,
/// updated_at` from the users table (no filters, no order): used by the user
/// list and the per-user filters.
const DB_SELECT_USER: &str = r#"
    SELECT id, email, full_name, role, status,
           CAST(created_at AS TEXT) AS created_at,
           CAST(last_login AS TEXT) AS last_login
    FROM users
"#;

const DB_SELECT_USER_BY_ID: &str = r#"
    SELECT id, email, full_name, role, status,
           CAST(created_at AS TEXT) AS created_at,
           CAST(last_login AS TEXT) AS last_login,
           CAST(updated_at AS TEXT) AS updated_at
    FROM users WHERE id = $1
"#;

const DB_SELECT_PENDING_EVENT: &str = r#"
    SELECT id, title, address, CAST(start_date AS TEXT) AS start_date,
           CAST(end_date AS TEXT) AS end_date
    FROM events WHERE status = 'pending'
"#;

const DB_SELECT_PENDING_CAMPAIGN: &str = r#"
    SELECT id, title, address, CAST(start_date AS TEXT) AS start_date
    FROM donation_campaigns WHERE status = 'pending'
"#;

const DB_SELECT_PENDING_SCHOLARSHIP: &str = r#"
    SELECT id, title, provider, CAST(deadline AS TEXT) AS deadline
    FROM scholarships WHERE status = 'pending'
"#;

const DB_UPDATE_USER_STATUS: &str = r#"
    UPDATE users SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, status, CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_SOFT_DELETE_USER: &str = r#"
    UPDATE users SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING id, CAST(deleted_at AS TEXT) AS deleted_at
"#;

const DB_RESTORE_USER: &str = r#"
    UPDATE users SET deleted_at = NULL, updated_at = NOW()
    WHERE id = $1
    RETURNING id, CAST(deleted_at AS TEXT) AS deleted_at
"#;

const DB_INSERT_AUDIT_LOG: &str = r#"
    INSERT INTO audit_logs (user_id, action, resource, resource_id, old_data, new_data)
    VALUES ($1, $2, $3, $4, $5, $6)
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AdminUserQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub search: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdminStats {
    pub total_users: i64,
    pub active_campaigns: i64,
    pub pending_verifications: i64,
    pub total_scholarships: i64,
    pub upcoming_events: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateUserStatusForm {
    pub status: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QuestionGapsQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ContentQuery {
    pub r#type: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Escape a fragment of user text so it cannot break the SQL mask (single
/// quotes double up; the mask is a literal-escaped string, never a bind).
fn esc_sql(v: &str) -> String {
    v.replace('\'', "''")
}

/// Filter a users-list query (search / role / status) into an `WHERE ... AND
/// ...` mask that is appended to `DB_SELECT_USER` — the filters are compiled
/// into the SQL text (never `.bind()` in a loop).
fn filter_clause(fields: &AdminUserQuery) -> String {
    let mut masks: Vec<String> = Vec::new();

    if let Some(search) = fields.search.as_ref().filter(|v| !v.trim().is_empty()) {
        let s = esc_sql(search);
        masks.push(format!("(LOWER(email) LIKE LOWER('%{}%') OR LOWER(full_name) LIKE LOWER('%{}%'))", s, s));
    }
    if let Some(role) = fields.role.as_ref().filter(|v| !v.trim().is_empty()) {
        masks.push(format!("role = '{}'", esc_sql(role)));
    }
    if let Some(status) = fields.status.as_ref().filter(|v| !v.trim().is_empty()) {
        masks.push(format!("status = '{}'", esc_sql(status)));
    }

    let clause = masks.join(" AND ");
    if clause.is_empty() { String::new() } else { format!("WHERE {}", clause) }
}

/// Soft-deleted or banned users are not returned by the list. A row with
/// `deleted_at` set is skipped the same way the old backend's `softDelete`
/// changed `deleted_at`.
fn deleted_at_clause() -> String {
    String::from(" AND deleted_at IS NULL")
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

/// `GET /api/admin/dashboard` — the admin dashboard statistics.
pub async fn get_stats(State(pool): State<DbPool>) -> Result<Json<ApiResponse<AdminStats>>, AppError> {
    let row = sqlx::query(DB_SELECT_STATS)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let pending_verifications = row.get::<i64>("pending_user_verifications")
        + row.get::<i64>("pending_campaign_approvals")
        + row.get::<i64>("pending_scholarship_approvals")
        + row.get::<i64>("pending_event_approvals");

    Ok(Json(ApiResponse::ok(AdminStats {
        total_users: row.get::<i64>("total_users"),
        active_campaigns: row.get::<i64>("active_campaigns"),
        pending_verifications,
        total_scholarships: row.get::<i64>("total_scholarships"),
        upcoming_events: row.get::<i64>("upcoming_events"),
    })))
}

// ---------------------------------------------------------------------------
// User management (list / detail / status / soft-delete / restore)
// ---------------------------------------------------------------------------

/// `GET /api/admin/users` — the user list with search + role + status filters
/// and pagination (the old backend's `AdminService.findAllUsers()`).
pub async fn get_users(
    State(pool): State<DbPool>,
    Query(q): Query<AdminUserQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    // The user list for the frontend shows active rows only.
    let where_clause = format!("{}{}", filter_clause(&q), deleted_at_clause());

    let list_sql = format!(
        "SELECT * FROM ({}) {} ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        DB_SELECT_USER,
        where_clause,
    );

    let total_sql = format!("SELECT COUNT(*) FROM ({}) {}", DB_SELECT_USER, where_clause);

    let total = sqlx::query(total_sql.as_str())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>("total");

    let rows = sqlx::query(&list_sql)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let users: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "email": row.get::<String>("email"),
            "full_name": row.get::<Option<String>>("full_name"),
            "role": row.get::<String>("role"),
            "status": row.get::<String>("status"),
            "created_at": row.get::<String>("created_at"),
            "last_login": row.get::<Option<String>>("last_login"),
        }))
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": users,
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": ((total + limit - 1) / limit).max(1),
        },
    }))))
}

/// `GET /api/admin/users/:id` — the user detail (old backend `findOneUser`).
pub async fn get_user_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_USER_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "email": row.get::<String>("email"),
            "full_name": row.get::<Option<String>>("full_name"),
            "role": row.get::<String>("role"),
            "status": row.get::<String>("status"),
            "created_at": row.get::<String>("created_at"),
            "last_login": row.get::<Option<String>>("last_login"),
            "updated_at": row.get::<Option<String>>("updated_at"),
        })))),
        None => Err(AppError::NotFound(format!(
            "Không tìm thấy người dùng."
        ))),
    }
}

/// `PUT /api/admin/users/:id/status` — ban / unban a user (`admin`, `moderator`
/// only, old backend `updateUserStatus`).
pub async fn update_user_status(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateUserStatusForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let valid_status = matches!(form.status.as_str(), "active" | "inactive" | "banned" | "pending");
    if !valid_status {
        return Err(AppError::BadRequest(
            "Trạng thái không hợp lệ (active, inactive, banned, pending)".to_string(),
        ));
    }

    let row = sqlx::query(DB_UPDATE_USER_STATUS)
        .bind(&form.status)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    log_user_action(&pool, &user, "UPDATE_USER_STATUS", &id, form.status.as_str(), form.reason.as_deref())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "status": row.get::<String>("status"),
        "updated_at": row.get::<String>("updated_at"),
    }))))
}

/// `DELETE /api/admin/users/:id` — soft delete the user (old backend
/// `softDeleteUser`).
pub async fn soft_delete_user(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let deleted = sqlx::query(DB_SOFT_DELETE_USER)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    log_user_action(&pool, &user, "SOFT_DELETE_USER", &id, "deleted", None)
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Xả mềm người dùng thành công.",
        "id": deleted.get::<String>("id"),
    }))))
}

/// `POST /api/admin/users/:id/restore` — restore a soft-deleted user (old
/// backend `restoreUser`).
pub async fn restore_user(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let restored = sqlx::query(DB_RESTORE_USER)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    log_user_action(&pool, &user, "RESTORE_USER", &id, "active", None)
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Khôi phục người dùng thành công.",
        "id": restored.get::<String>("id"),
    }))))
}

/// Log an admin management action (the old `AuditLogService.log`).
async fn log_user_action(
    pool: &DbPool,
    user: &AuthUser,
    action: &str,
    resource_id: &str,
    status: &str,
    reason: Option<&str>,
) -> Result<(), AppError> {
    let resource = "user";
    let old_data = serde_json::json!({});
    let new_data = serde_json::json!({ "action": action, "status": status, "reason": reason });

    sqlx::query(DB_INSERT_AUDIT_LOG)
        .bind(&user.id)
        .bind(action)
        .bind(resource)
        .bind(&resource_id)
        .bind(&old_data)
        .bind(&new_data)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Content review (pending items)
// ---------------------------------------------------------------------------

/// `GET /api/admin/content/pending?type=` — the pending content list (`event`,
/// `campaign`, `scholarship`).
pub async fn get_pending_content(
    State(pool): State<DbPool>,
    Query(q): Query<ContentQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let items = match q.r#type.as_str() {
        "event" => {
            let rows = sqlx::query(DB_SELECT_PENDING_EVENT)
                .fetch_all(pool.db())
                .await
                .map_err(AppError::from)?;
            let total = rows.len() as i64;
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|row| serde_json::json!({
                    "id": row.get::<String>("id"),
                    "title": row.get::<String>("title"),
                    "address": row.get::<Option<String>>("address"),
                    "start_date": row.get::<Option<String>>("start_date"),
                    "end_date": row.get::<Option<String>>("end_date"),
                }))
                .collect();
            (items, total)
        }
        "campaign" => {
            let rows = sqlx::query(DB_SELECT_PENDING_CAMPAIGN)
                .fetch_all(pool.db())
                .await
                .map_err(AppError::from)?;
            let total = rows.len() as i64;
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|row| serde_json::json!({
                    "id": row.get::<String>("id"),
                    "title": row.get::<String>("title"),
                    "address": row.get::<Option<String>>("address"),
                    "start_date": row.get::<Option<String>>("start_date"),
                }))
                .collect();
            (items, total)
        }
        "scholarship" => {
            let rows = sqlx::query(DB_SELECT_PENDING_SCHOLARSHIP)
                .fetch_all(pool.db())
                .await
                .map_err(AppError::from)?;
            let total = rows.len() as i64;
            let items: Vec<serde_json::Value> = rows
                .iter()
                .map(|row| serde_json::json!({
                    "id": row.get::<String>("id"),
                    "title": row.get::<String>("title"),
                    "provider": row.get::<Option<String>>("provider"),
                    "deadline": row.get::<Option<String>>("deadline"),
                }))
                .collect();
            (items, total)
        }
        _ => return Err(AppError::BadRequest("Loại nội dung không hợp lệ.")),
    };

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "type": q.r#type,
        "items": items,
        "count": total,
    }))))
}

// ---------------------------------------------------------------------------
// AI reports (it delegates to the ai-service; the response is passed through)
// ---------------------------------------------------------------------------

/// `POST /api/admin/data-quality/report` — proxy to the ai-service
/// `dataQualityReport` (`POST /api/ai/data/quality/report`).
pub async fn data_quality_report(
    req: Request,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let report = proxy_to_ai_service("/api/ai/data/quality/report", body).await?;

    Ok(Json(ApiResponse::ok(report)))
}

/// `GET /api/admin/question-gaps` — proxy to the ai-service
/// `GET /api/ai/analytics/question-gaps`.
pub async fn get_question_gaps(
    req: Request,
    Query(q): Query<QuestionGapsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let path = if q.limit.is_some() {
        format!("/api/ai/analytics/question-gaps?limit={}", q.limit.unwrap_or(10000))
    } else {
        "/api/ai/analytics/question-gaps".to_string()
    };

    let gaps = proxy_get_aiservice(&path).await?;

    Ok(Json(ApiResponse::ok(gaps)))
}

/// \(

/// `GET /api/admin/auto-scheduler/health` — proxy to the ai-service
/// `GET /api/ai/auto/health`.
pub async fn get_auto_scheduler_health() -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let health = proxy_get_aiservice("/api/ai/auto/health").await?;

    Ok(Json(ApiResponse::ok(health)))
}

/// `POST /api/admin/crawl-map` — the map crawler is still handled by the NestJS
/// module until the Rust `crawler` module is ported; return a degraded ack so
/// the Frontend never sees a 502. (`/api/admin/crawl-map` is also a maintenance
/// endpoint: it runs `crawlerService.crawlNationwide()` on demand.)
pub async fn crawl_map(
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Crawl is handled by the crawler module (degraded).",
        "degraded": true,
    }))))
}