//! Share module — `/api/share/*`: chia sẻ sách/tài liệu/học cụ và yêu cầu
//! mượn (borrow requests).
//!
//! Mirrors `backend/src/modules/share/share.controller.ts` +
//! `share.service.ts`. Endpoint đọc là công khai; các write handler tự kiểm
//! JWT. Tên/mô tả được làm sạch trước khi ghi DB (tương đương
//! `SanitizeService.clean`).

use crate::common::auth::authenticated_user;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, Query, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ItemsQuery {
    pub category: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateItem {
    pub name: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BorrowRequest {
    pub message: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_ITEMS: &str = r#"
SELECT id, name, category, description, status, lat, lng, address, owner_id,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM shared_items
WHERE status = 'available'
"#;

const DB_ITEM_BY_ID: &str = r#"SELECT id, owner_id FROM shared_items WHERE id = $1"#;

const DB_INSERT_ITEM: &str = r#"
INSERT INTO shared_items (name, category, description, status, owner_id,
    lat, lng, address, created_at, updated_at)
VALUES ($1, $2, $3, 'available', $4, $5, $6, $7, NOW(), NOW())
RETURNING id
"#;

const DB_MY_REQUESTS: &str = r#"
SELECT br.id, br.item_id, br.message, br.status, br.requester_id,
       si.name AS item_name, si.category, si.owner_id,
       CAST(br.created_at AS TEXT) AS created_at
FROM borrow_requests br
JOIN shared_items si ON si.id = br.item_id
WHERE br.requester_id = $1
ORDER BY br.created_at DESC
"#;

const DB_INSERT_REQUEST: &str = r#"
INSERT INTO borrow_requests (item_id, requester_id, message, status)
VALUES ($1, $2, $3, 'pending')
RETURNING id
"#;

const DB_PENDING_REQUEST: &str = r#"
SELECT id FROM borrow_requests
WHERE item_id = $1 AND requester_id = $2
  AND status IN ('pending', 'approved')
LIMIT 1
"#;

const DB_RETURN_REQUEST: &str = r#"
UPDATE borrow_requests SET status = 'returned', updated_at = NOW()
WHERE item_id = $1 AND requester_id = $2
  AND status IN ('pending', 'approved')
ORDER BY created_at ASC
LIMIT 1
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Làm sạch chuỗi trước khi ghi DB: cắt khoảng trắng thừa và loại bỏ các
//! thẻ HTML thô (tương đương `SanitizeService.clean`).
fn clean(value: &str) -> String {
    let stripped = value.replace(|c: char| c < ' ', " ");
    let no_html = stripped.replace(['<', '>'], " ");
    no_html.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sql_text(value: &str) -> String {
    value.replace('\'', "''")
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/share/items?category=` — danh sách tài nguyên có sẵn.
pub async fn get_items(
    State(pool): State<DbPool>,
    Query(q): Query<ItemsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let mut sql = DB_ITEMS.to_string();
    if let Some(cat) = q.category.as_ref().filter(|v| !v.is_empty()) {
        sql = sql.replace(
            "WHERE status = 'available'",
            &format!("WHERE status = 'available' AND category = '{}'", sql_text(cat)),
        );
    }

    let rows = sqlx::query(&sql)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared items: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String>("id"),
                "name": row.get::<Option<String>>("name"),
                "category": row.get::<Option<String>>("category"),
                "description": row.get::<Option<String>>("description"),
                "status": row.get::<Option<String>>("status"),
                "lat": row.get::<Option<f64>>("lat"),
                "lng": row.get::<Option<f64>>("lng"),
                "address": row.get::<Option<String>>("address"),
                "ownerId": row.get::<Option<String>>("owner_id"),
                "createdAt": row.get::<Option<String>>("created_at"),
                "updatedAt": row.get::<Option<String>>("updated_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items", "total": items.len() as i64 }))))
}

/// `POST /api/share/items` — đăng tải tài nguyên mới.
pub async fn create_item(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreateItem>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let name = clean(&body.name);
    if name.is_empty() {
        return Err(AppError::BadRequest("Tên tài liệu/học cụ không hợp lệ".to_string()));
    }

    let row = sqlx::query(DB_INSERT_ITEM)
        .bind(&name)
        .bind(body.category.as_deref().unwrap_or("book"))
        .bind(body.description.as_deref().map(|d| clean(d)).as_deref().unwrap_or(""))
        .bind(user.id.as_str())
        .bind(body.lat)
        .bind(body.lng)
        .bind(body.address.as_deref().unwrap_or(""))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create shared item: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": row.get::<String>("id") }))))
}

/// `GET /api/share/me/requests` — danh sách yêu cầu mượn của người dùng.
pub async fn get_my_requests(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_MY_REQUESTS)
        .bind(user.id.as_str())
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read borrow requests: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String>("id"),
                "itemId": row.get::<Option<String>>("item_id"),
                "itemName": row.get::<Option<String>>("item_name"),
                "category": row.get::<Option<String>>("category"),
                "message": row.get::<Option<String>>("message"),
                "status": row.get::<Option<String>>("status"),
                "requesterId": row.get::<Option<String>>("requester_id"),
                "ownerId": row.get::<Option<String>>("owner_id"),
                "createdAt": row.get::<Option<String>>("created_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items", "total": items.len() as i64 }))))
}

/// `POST /api/share/items/:id/request` — gửi yêu cầu mượn.
pub async fn request_item(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<BorrowRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let item = sqlx::query(DB_ITEM_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let item = match item {
        Some(r) => r,
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    if item.get::<String>("owner_id") == user.id {
        return Err(AppError::BadRequest("Không thể mượn chính tài nguyên của mình.".to_string()));
    }

    let dup = sqlx::query(DB_PENDING_REQUEST)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to check pending request: {e}")))?;

    if dup.is_some() {
        return Err(AppError::Conflict("Bạn đã có yêu cầu mượn đang chờ cho tài nguyên này.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_REQUEST)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .bind(body.message.as_deref().unwrap_or(""))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create borrow request: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": row.get::<String>("id"), "message": "Yêu cầu mượn đã được gửi." }))))
}

/// `POST /api/share/items/:id/return` — chủ sở hữu xác nhận nhận lại.
pub async fn return_item(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let item = sqlx::query(DB_ITEM_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let item = match item {
        Some(r) => r,
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    if item.get::<String>("owner_id") != user.id {
        return Err(AppError::Forbidden("Chỉ chủ sở hữu mới có thể xác nhận nhận lại.".to_string()));
    }

    let updated = sqlx::query(DB_RETURN_REQUEST)
        .bind(id.as_str())
        .execute(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to return item: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "returned": updated.rows_affected() > 0,
        "message": if updated.rows_affected() > 0 {
            "Đã xác nhận nhận lại tài nguyên."
        } else {
            "Không có yêu cầu mượn đang chờ cho tài nguyên này."
        },
    }))))
}