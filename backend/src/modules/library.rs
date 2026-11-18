//! Library module — `/api/library/*`: tài liệu học tập (resources), tìm kiếm,
//! tóm tắt AI và tạo tài liệu mới.
//!
//! Mirrors `backend/src/modules/library/library.controller.ts` +
//! `library.service.ts`:
//! - `GET /library/resources` — phân trang (`page`/`limit`), ẩn mục hủy
//!   (deleted_at IS NULL).
//! - `GET /library/search` — `?q=&category=&type=&page=&limit=`.
//! - `GET /library/resources/:id` — chi tiết.
//! - `GET /library/resources/:id/summary` — proxy tóm tắt AI
//!   (`POST /api/ai/library/summarize` của ai-service).
//! - `POST /library/resources` — JWT, tạo tài liệu + chínhpcf đưa vào vector
//!   store.
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).
//! Postgres/PostGIS only.

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ResourceListQuery {
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResourceSearchQuery {
    pub q: Option<String>,
    pub page: Option<String>,
    pub limit: Option<String>,
    pub subject: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub resource_type: Option<String>,
}

/// `author` giữ lại để khách gửi kèm (không đọc).
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct CreateResourceForm {
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub resource_type: Option<String>,
    pub subject: Option<String>,
    pub grade: Option<String>,
    pub author: Option<String>,
    pub file_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub tags: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_RESOURCES: &str = r#"
    SELECT id::text AS id, title, description, type, subject, grade,
           file_url, thumbnail_url, file_size, download_count, view_count,
           COALESCE(rating_avg, 0)::float8 AS rating_avg, status, author_id::text AS author_id,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM learning_materials
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
"#;

const DB_SELECT_RESOURCES_COUNT: &str = r#"
    SELECT COUNT(*) AS total
    FROM learning_materials
    WHERE deleted_at IS NULL
"#;

const DB_SELECT_SEARCH: &str = r#"
    SELECT id::text AS id, title, description, type, subject, grade,
           file_url, thumbnail_url, file_size, download_count, view_count,
           COALESCE(rating_avg, 0)::float8 AS rating_avg, status, author_id::text AS author_id,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM learning_materials
    WHERE deleted_at IS NULL
    {where}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
"#;

const DB_SELECT_SEARCH_COUNT: &str = r#"
    SELECT COUNT(*) AS total
    FROM learning_materials
    WHERE deleted_at IS NULL
    {where}
"#;

const DB_SELECT_RESOURCE_BY_ID: &str = r#"
    SELECT id::text AS id, title, description, type, subject, grade,
           file_url, thumbnail_url, file_size, download_count, view_count,
           COALESCE(rating_avg, 0)::float8 AS rating_avg, status, author_id::text AS author_id,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM learning_materials WHERE id = $1
"#;

const DB_INSERT_RESOURCE: &str = r#"
    INSERT INTO learning_materials (title, description, type, subject, grade,
                                    author_id, file_url, thumbnail_url, tags,
                                    status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', NOW(), NOW())
    RETURNING id::text AS id, title, description, type, subject, grade, file_url,
              thumbnail_url, download_count, view_count, status,
              CAST(created_at AS TEXT) AS created_at
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn resource_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "title": crate::db::text(&row, "title"),
        "description": crate::db::opt_text(&row, "description"),
        "type": crate::db::opt_text(&row, "type"),
        "subject": crate::db::opt_text(&row, "subject"),
        "grade": crate::db::opt_text(&row, "grade"),
        "file_url": crate::db::opt_text(&row, "file_url"),
        "thumbnail_url": crate::db::opt_text(&row, "thumbnail_url"),
        "file_size": row.get::<Option<i64>, &str>("file_size"),
        "download_count": row.get::<i64, &str>("download_count"),
        "view_count": row.get::<i64, &str>("view_count"),
        "rating_avg": crate::db::num(&row, "rating_avg"),
        "status": crate::db::opt_text(&row, "status"),
        "author_id": crate::db::opt_text(&row, "author_id"),
        "created_at": crate::db::opt_text(&row, "created_at"),
        "updated_at": crate::db::opt_text(&row, "updated_at"),
    })
}



// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/library/resources` — tài liệu đang có, phân trang.
pub async fn get_resources(
    State(pool): State<DbPool>,
    Query(q): Query<ResourceListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or_else(|| "1".to_string()).parse::<i64>().unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or_else(|| "10".to_string()).parse::<i64>().unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * limit;

    let rows = crate::db::query(DB_SELECT_RESOURCES)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let total = crate::db::query(DB_SELECT_RESOURCES_COUNT)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64, &str>("total");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(resource_to_json).collect::<Vec<_>>(),
        "meta": {
            "totalItems": total,
            "itemsPerPage": limit,
            "totalPages": ((total as f64 / limit as f64).ceil() as i64).max(1),
            "currentPage": page,
        },
    }))))
}

/// `GET /api/library/search` — tìm theo nội dung + loại + môn.
pub async fn search_resources(
    State(pool): State<DbPool>,
    Query(q): Query<ResourceSearchQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    // `category` cũ trả về `subject`: cả 2 tham số được chấp nhận.
    let subject = q.subject.or(q.category);
    let query = q.q;
    let page = q.page.unwrap_or_else(|| "1".to_string()).parse::<i64>().unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or_else(|| "10".to_string()).parse::<i64>().unwrap_or(10).max(1).min(100);
    let offset = (page - 1) * limit;

    let mut clauses: Vec<String> = Vec::new();
    if let Some(q_) = query.as_ref().filter(|v| !v.trim().is_empty()) {
        let q_ = q_.replace('\'', "''");
        clauses.push(format!(
            "(LOWER(title) LIKE LOWER('%{}%') OR LOWER(description) LIKE LOWER('%{}%'))",
            q_, q_
        ));
    }
    if let Some(cat) = subject.as_ref().filter(|v| !v.trim().is_empty()) {
        let cat = cat.replace('\'', "''");
        clauses.push(format!("type = '{}' OR subject = '{}'", cat, cat));
    }
    if let Some(ty) = q.resource_type.as_ref().filter(|v| !v.trim().is_empty()) {
        let ty = ty.replace('\'', "''");
        clauses.push(format!("type = '{}'", ty));
    }
    let where_clause = clauses.join(" AND ");
    let where_clause = if where_clause.is_empty() {
        String::new()
    } else {
        format!("AND {}", where_clause)
    };

    let sql = DB_SELECT_SEARCH.replace("{where}", &where_clause);
    let count_sql = DB_SELECT_SEARCH_COUNT.replace("{where}", &where_clause);

    let rows = crate::db::query(sql.as_str())
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let total = crate::db::query(count_sql.as_str())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64, &str>("total");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(resource_to_json).collect::<Vec<_>>(),
        "meta": {
            "totalItems": total,
            "itemsPerPage": limit,
            "totalPages": ((total as f64 / limit as f64).ceil() as i64).max(1),
            "currentPage": page,
        },
    }))))
}

/// `GET /api/library/resources/:id` — chi tiết tài liệu.
pub async fn get_resource_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_SELECT_RESOURCE_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "resource": resource_to_json(&r),
        })))),
        None => Err(AppError::NotFound(
            "Không tìm thấy tài liệu này.".to_string(),
        )),
    }
}

/// `GET /api/library/resources/:id/summary` — tóm tắt tài liệu qua AI (proxy
/// `POST /api/ai/library/summarize` của ai-service).
pub async fn summarize_resource(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_SELECT_RESOURCE_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let material = match row {
        Some(r) => resource_to_json(&r),
        None => return Err(AppError::NotFound(
            "Không tìm thấy tài liệu này.".to_string(),
        )),
    };

    let title = material.get("title").and_then(|v| v.as_str()).unwrap_or_default();
    let description = material.get("description").and_then(|v| v.as_str()).unwrap_or_default();
    let resource_type = material.get("type").and_then(|v| v.as_str()).unwrap_or_default();
    let subject = material.get("subject").and_then(|v| v.as_str()).unwrap_or_default();
    let tags = material.get("tags").cloned().unwrap_or(Value::Null);

    let body = serde_json::json!({
        "title": title,
        "description": description,
        "category": subject,
        "type": resource_type,
        "tags": tags,
    });

    let summary = proxy_to_ai_service("/api/ai/library/summarize", body).await?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "summary": summary,
    }))))
}

/// `POST /api/library/resources` — tạo tài liệu học tập (JWT) + đẩy vào vector
/// store qua ai-service.
pub async fn create_resource(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(form): Json<CreateResourceForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    if form.title.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Tiêu đề tài liệu là bắt buộc.".to_string(),
        ));
    }

    let tags = form.tags
        .as_deref()
        .filter(|v| !v.trim().is_empty())
        .map(|v| if v.starts_with('[') { v.to_string() } else { format!("['{}']", v.replace('\'', "''")) });

    let row = crate::db::query(DB_INSERT_RESOURCE)
        .bind(&form.title)
        .bind(form.description.as_deref())
        .bind(form.resource_type.as_deref())
        .bind(form.subject.as_deref())
        .bind(form.grade.as_deref())
        .bind(Some(user.id.as_str()))
        .bind(form.file_url.as_deref())
        .bind(form.thumbnail_url.as_deref())
        .bind(tags.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    // Đưa tài liệu mới vào vector store (tương đương
    // `aiService.embedDocument` — lỗi chỉ được ghi log, không chặn việc tạo).
    let doc_text = format!("Tai lieu hoc tap: {}. The loai: {}. Mon: {}. Tom tat: {}.",
        form.title,
        form.resource_type.as_deref().unwrap_or(""),
        form.subject.as_deref().unwrap_or(""),
        form.description.as_deref().unwrap_or(""));
    let _ = proxy_to_ai_service("/api/ai/library/embed", serde_json::json!({
        "text": doc_text,
        "metadata": {
            "title": form.title,
            "category": form.subject,
            "source": "db_learning_materials",
            "type": form.resource_type,
        },
        "id": format!("material_{}", crate::db::text(&row, "id")),
    })).await;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "resource": resource_to_json(&row),
    }))))
}
