//! Role module — `/api/roles/*`: quản lý vai trò RBAC (danh sách, chi tiết,
//! tạo vai trò).
//!
//! Mirrors `backend/src/modules/role/role.controller.ts` + `role.service.ts`.
//! Tất cả endpoint dành cho admin/moderator (old controller có
//! `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN, MODERATOR)`).
//!
//! `roles.id` là `SERIAL` → đọc/đóng dưới `i64` (không phải UUID).

use crate::common::auth::{AuthUser, authenticated_user, ensure_admin};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateRole {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub level: Option<i64>,
    pub system_created: Option<bool>,
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_ROLES: &str = r#"
SELECT id, name, display_name, description, level, system_created,
       CAST(created_at AS TEXT) AS created_at
FROM roles ORDER BY name
"#;

const DB_ROLE_BY_ID: &str = r#"
SELECT id, name, display_name, description, level, system_created,
       CAST(created_at AS TEXT) AS created_at
FROM roles WHERE id = $1
"#;

const DB_INSERT_ROLE: &str = r#"
INSERT INTO roles (name, display_name, description, level, system_created)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, display_name, description, level, system_created,
          CAST(created_at AS TEXT) AS created_at
"#;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/roles` — danh sách tất cả vai trò (admin/moderator).
pub async fn find_all(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    ensure_admin(&user)?;

    let rows = crate::db::query(DB_ROLES)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read roles: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": crate::db::int(&row, "id"),
                "name": crate::db::opt_text(&row, "name"),
                "displayName": crate::db::opt_text(&row, "display_name"),
                "description": crate::db::opt_text(&row, "description"),
                "level": crate::db::opt_int(&row, "level"),
                "systemCreated": crate::db::opt_flag(&row, "system_created"),
                "createdAt": crate::db::opt_text(&row, "created_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `GET /api/roles/:id` — chi tiết một vai trò.
pub async fn find_one(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    ensure_admin(&user)?;

    let id_num = id.parse::<i64>().map_err(|_| AppError::BadRequest("Role id must be an integer.".to_string()))?;
    let row = crate::db::query(DB_ROLE_BY_ID)
        .bind(id_num)
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read role: {e}")))?;

    let row = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Không tìm thấy vai trò được yêu cầu.".to_string())),
    };

    let result = serde_json::json!({
        "id": crate::db::int(&row, "id"),
        "name": crate::db::opt_text(&row, "name"),
        "displayName": crate::db::opt_text(&row, "display_name"),
        "description": crate::db::opt_text(&row, "description"),
        "level": crate::db::opt_int(&row, "level"),
        "systemCreated": crate::db::opt_flag(&row, "system_created"),
        "createdAt": crate::db::opt_text(&row, "created_at"),
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `POST /api/roles` — tạo vai trò mới.
pub async fn create(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<CreateRole>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    ensure_admin(&user)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("name is required and must not be empty.".to_string()));
    }

    let row = crate::db::query(DB_INSERT_ROLE)
        .bind(name)
        .bind(body.display_name.as_deref())
        .bind(body.description.as_deref())
        .bind(body.level.unwrap_or(0))
        .bind(body.system_created.unwrap_or(false))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create role: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": crate::db::int(&row, "id"),
        "name": crate::db::text(&row, "name"),
    }))))
}