//! Audit-log module — `/api/audit-logs`: nhật ký hoạt động hệ thống (admin /
//! moderator), lọc theo người dùng, hành động và tài nguyên, phân trang.
//!
//! Mirrors `backend/src/modules/audit-log/audit-log.controller.ts` +
//! `audit-log.service.ts` (`findAll`). Every route requires a JWT with the
//! `admin`/`moderator` role (`@Roles(ADMIN, MODERATOR)` + `JwtAuthGuard` ở
//! old backend — giao diện xác thực được tự kiểm ở handler).
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Query, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập (route `/api/audit-logs` yêu cầu JWT + admin).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` chỉ (`@Roles(ADMIN, MODERATOR)` ở old backend).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string()),
        );
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

/// Nhật ký + thông tin người thực hiện (join trái với `users`): `item.user`
/// là `{ full_name, email }` cho giao diện.
const DB_SELECT_LOGS: &str = r#"
    SELECT a.id, a.user_id, a.action, a.resource, a.resource_id,
           a.old_data, a.new_data, a.ip_address, a.user_agent,
           CAST(a.created_at AS TEXT) AS created_at,
           u.full_name AS user_full_name, u.email AS user_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    {where}
    ORDER BY a.created_at DESC
"#;

/// Bản tóm tắt tổng số (không `ORDER BY`, không `LIMIT`/`OFFSET`).
const DB_COUNT_LOGS: &str = r#"
    SELECT COUNT(*) FROM (
        SELECT a.id
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        {where}
    ) t
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// `GET /api/audit-logs` — bộ lọc + phân trang của old backend.
#[derive(Debug, Clone, Deserialize)]
pub struct AuditLogQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub resource: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Một fragment `WHERE a.user_id = '...' AND ...` (trống khi không có bộ
/// lọc) — nhúng sẵn vào SQL, chỉ `limit`/`offset` được bind ở runtime.
fn filter_clause(fields: &AuditLogQuery) -> String {
    let mut masks: Vec<String> = Vec::new();

    if let Some(user_id) = fields.user_id.as_ref().filter(|v| !v.trim().is_empty()) {
        masks.push(format!("a.user_id = '{}'", user_id.replace('\'', "''")));
    }
    if let Some(action) = fields.action.as_ref().filter(|v| !v.trim().is_empty()) {
        masks.push(format!("a.action = '{}'", action.replace('\'', "''")));
    }
    if let Some(resource) = fields.resource.as_ref().filter(|v| !v.trim().is_empty()) {
        masks.push(format!("a.resource = '{}'", resource.replace('\'', "''")));
    }

    let clause = masks.join(" AND ");
    if clause.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clause)
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/audit-logs` — danh sách nhật ký hoạt động (admin / moderator).
pub async fn get_logs(
    State(pool): State<DbPool>,
    req: Request,
    Query(q): Query<AuditLogQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let where_clause = filter_clause(&q);

    let list_sql = format!(
        "{} LIMIT $1 OFFSET $2",
        DB_SELECT_LOGS.replace("{where}", &where_clause),
    );

    let total_sql = format!(
        "{}",
        DB_COUNT_LOGS.replace("{where}", &where_clause),
    );

    let total = sqlx::query(total_sql.as_str())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>("count");

    let rows = sqlx::query(&list_sql)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "action": row.get::<String>("action"),
            "resource": row.get::<Option<String>>("resource"),
            "resource_id": row.get::<Option<String>>("resource_id"),
            "old_data": row.get::<Option<Value>>("old_data"),
            "new_data": row.get::<Option<Value>>("new_data"),
            "ip_address": row.get::<Option<String>>("ip_address"),
            "user_agent": row.get::<Option<String>>("user_agent"),
            "created_at": row.get::<String>("created_at"),
            "user": {
                "full_name": row.get::<Option<String>>("user_full_name"),
                "email": row.get::<Option<String>>("user_email"),
            },
        }))
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": items,
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": ((total + limit - 1) / limit).max(1),
        },
    }))))
}
