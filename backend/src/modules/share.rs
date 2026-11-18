//! Share module — `/api/share/*`: chia sẻ sách/tài liệu/học cụ và yêu cầu
//! mượn (borrow requests).
//!
//! Mirrors `backend/src/modules/share/share.controller.ts` +
//! `share.service.ts`. Endpoint đọc là công khai; các write handler tự kiểm
//! JWT. Tên/mô tả được làm sạch trước khi ghi DB (tương đương
//! `SanitizeService.clean`).

use crate::common::auth::{AuthUser, authenticated_user};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

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
pub struct UpdateItem {
    pub name: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
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

const DB_ITEM_BY_ID: &str = r#"SELECT id, owner_id FROM shared_items WHERE id::text = $1"#;

const DB_ITEM_FULL: &str = r#"
SELECT id, name, category, description, status, lat, lng, address, owner_id,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM shared_items WHERE id::text = $1
"#;

const DB_UPDATE_ITEM: &str = r#"
UPDATE shared_items SET name = $1, category = $2, description = $3,
    status = $4, lat = $5, lng = $6, address = $7, updated_at = NOW()
WHERE id::text = $8 AND owner_id::text = $9
"#;

const DB_DELETE_ITEM: &str = r#"DELETE FROM shared_items WHERE id::text = $1 AND owner_id::text = $2"#;

const DB_INSERT_ITEM: &str = r#"
INSERT INTO shared_items (name, category, description, status, owner_id,
    lat, lng, address, created_at, updated_at)
VALUES ($1,$2,$3,'available',$4::uuid,$5,$6,$7,NOW(),NOW())
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
// thẻ HTML thô (tương đương `SanitizeService.clean`).
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

    let rows = crate::db::query(&sql)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared items: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": crate::db::text(&row, "id"),
                "name": crate::db::opt_text(&row, "name"),
                "category": crate::db::opt_text(&row, "category"),
                "description": crate::db::opt_text(&row, "description"),
                "status": crate::db::opt_text(&row, "status"),
                "lat": crate::db::opt_num(&row, "lat"),
                "lng": crate::db::opt_num(&row, "lng"),
                "address": crate::db::opt_text(&row, "address"),
                "ownerId": crate::db::opt_text(&row, "owner_id"),
                "createdAt": crate::db::opt_text(&row, "created_at"),
                "updatedAt": crate::db::opt_text(&row, "updated_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `POST /api/share/items` — đăng tải tài nguyên mới.
pub async fn create_item(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<CreateItem>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    let name = clean(&body.name);
    if name.is_empty() {
        return Err(AppError::BadRequest("Tên tài liệu/học cụ không hợp lệ".to_string()));
    }

    let row = crate::db::query(DB_INSERT_ITEM)
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

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": crate::db::text(&row, "id") }))))
}

/// `GET /api/share/items/{id}` — chi tiết một tài nguyên (công khai).
pub async fn get_item(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_ITEM_FULL)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let item = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": crate::db::text(&item, "id"),
        "name": crate::db::opt_text(&item, "name"),
        "category": crate::db::opt_text(&item, "category"),
        "description": crate::db::opt_text(&item, "description"),
        "status": crate::db::opt_text(&item, "status"),
        "lat": crate::db::opt_num(&item, "lat"),
        "lng": crate::db::opt_num(&item, "lng"),
        "address": crate::db::opt_text(&item, "address"),
        "ownerId": crate::db::opt_text(&item, "owner_id"),
        "createdAt": crate::db::opt_text(&item, "created_at"),
        "updatedAt": crate::db::opt_text(&item, "updated_at"),
    }))))
}

/// `PUT /api/share/items/{id}` — chủ sở hữu cập nhật thông tin tài nguyên.
pub async fn update_item(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateItem>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let owner = crate::db::query("SELECT owner_id FROM shared_items WHERE id::text = $1")
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let owner = match owner {
        Some(r) => crate::db::text(&r, "owner_id"),
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    if owner != user.id {
        return Err(AppError::Forbidden("Chỉ chủ sở hữu mới có thể chỉnh sửa tài nguyên.".to_string()));
    }

    let name = body.name.as_deref().map(clean).filter(|s| !s.is_empty());
    let rows = crate::db::query(DB_UPDATE_ITEM)
        .bind(name.unwrap_or_default())
        .bind(body.category.as_deref().unwrap_or("book"))
        .bind(body.description.as_deref().map(clean).as_deref().unwrap_or(""))
        .bind(body.status.as_deref().unwrap_or("available"))
        .bind(body.lat)
        .bind(body.lng)
        .bind(body.address.as_deref().unwrap_or(""))
        .bind(id.as_str())
        .bind(user.id.as_str())
        .execute(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to update shared item: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "updated": rows.rows_affected() > 0 }))))
}

/// `DELETE /api/share/items/{id}` — chủ sở hữu xóa tài nguyên.
pub async fn delete_item(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let rows = crate::db::query(DB_DELETE_ITEM)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .execute(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to delete shared item: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "deleted": rows.rows_affected() > 0 }))))
}

/// `GET /api/share/me/requests` — danh sách yêu cầu mượn của người dùng.
pub async fn get_my_requests(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let rows = crate::db::query(DB_MY_REQUESTS)
        .bind(user.id.as_str())
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read borrow requests: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": crate::db::text(&row, "id"),
                "itemId": crate::db::opt_text(&row, "item_id"),
                "itemName": crate::db::opt_text(&row, "item_name"),
                "category": crate::db::opt_text(&row, "category"),
                "message": crate::db::opt_text(&row, "message"),
                "status": crate::db::opt_text(&row, "status"),
                "requesterId": crate::db::opt_text(&row, "requester_id"),
                "ownerId": crate::db::opt_text(&row, "owner_id"),
                "createdAt": crate::db::opt_text(&row, "created_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `POST /api/share/items/:id/request` — gửi yêu cầu mượn.
pub async fn request_item(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(body): Json<BorrowRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let item = crate::db::query(DB_ITEM_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let item = match item {
        Some(r) => r,
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    if crate::db::text(&item, "owner_id") == user.id {
        return Err(AppError::BadRequest("Không thể mượn chính tài nguyên của mình.".to_string()));
    }

    let dup = crate::db::query(DB_PENDING_REQUEST)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to check pending request: {e}")))?;

    if dup.is_some() {
        return Err(AppError::Conflict("Bạn đã có yêu cầu mượn đang chờ cho tài nguyên này.".to_string()));
    }

    let row = crate::db::query(DB_INSERT_REQUEST)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .bind(body.message.as_deref().unwrap_or(""))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create borrow request: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": crate::db::text(&row, "id"), "message": "Yêu cầu mượn đã được gửi." }))))
}

/// `POST /api/share/items/:id/return` — chủ sở hữu xác nhận nhận lại.
pub async fn return_item(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let item = crate::db::query(DB_ITEM_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read shared item: {e}")))?;

    let item = match item {
        Some(r) => r,
        None => return Err(AppError::NotFound("Tài nguyên không tồn tại".to_string())),
    };

    if crate::db::text(&item, "owner_id") != user.id {
        return Err(AppError::Forbidden("Chỉ chủ sở hữu mới có thể xác nhận nhận lại.".to_string()));
    }

    let updated = crate::db::query(DB_RETURN_REQUEST)
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