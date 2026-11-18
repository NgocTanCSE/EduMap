//! Bookmarks module — `/api/bookmarks/*`: đánh dấu (bookmark) nội dung yêu
//! thích, có lọc theo loại (`?target_type=`) — danh sách join tiêu đề của
//! từng loại, toggle bỏ/ưa thích.
//!
//! Routing table (tất cả các endpoints cần JWT):
//!
//! ```text
//! GET  /api/bookmarks?target_type=... -> JWT, danh sách bookmark (title join)
//! POST /api/bookmarks                 -> JWT, toggle (ưa/bỏ)
//! ```
//!
//! Mirrors `backend/src/modules/bookmarks/bookmarks.controller.ts` +
//! `bookmarks.service.ts` (`listBookmarksDetailed` + `toggleBookmark`).
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị
//! cấm). Postgres-only.
//!
//! Tiền bối của old service: `TITLE_JOINS` — 11 loại có join; loại khác trả
//! về `title = null`.

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// `GET /api/bookmarks?target_type=` — bộ lọc đối tượng bookmark.
/// `target_type` giữ lại để client gửi kèm (không đọc).
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    target_type: Option<String>,
}

/// Body của `POST /api/bookmarks` (toggle).
#[derive(Debug, Deserialize)]
pub struct ToggleForm {
    target_type: String,
    target_id: String,
}

/// Đối tượng bookmark trả về (bảng `bookmarks`).
/// `title` không đọc (tiêu đề lấy theo `target_type` riêng — xem `list()`).
#[allow(dead_code)]
struct BookmarkItem {
    target_type: String,
    target_id: String,
    title: Option<String>,
    created_at: String,
}

/// Nhóm bookmark theo `target_type` để fetch title cho từng loại; giống
/// `TITLE_JOINS` của old backend (11 loại + graceful cho loại còn lại).
#[derive(Debug)]
struct TitleJoin {
    table: String,
    label: String,
}

fn title_join(type_name: &str) -> Option<TitleJoin> {
    match type_name {
        "poi" => Some(TitleJoin { table: "map_points".into(), label: "name".into() }),
        "job" => Some(TitleJoin { table: "jobs".into(), label: "title".into() }),
        "event" => Some(TitleJoin { table: "events".into(), label: "title".into() }),
        "opportunity" => Some(TitleJoin { table: "opportunities".into(), label: "title".into() }),
        "internships" => Some(TitleJoin { table: "internships".into(), label: "title".into() }),
        "scholarships" => Some(TitleJoin { table: "scholarships".into(), label: "title".into() }),
        "marketplace_product" => Some(TitleJoin {
            table: "products".into(),
            label: "name".into(),
        }),
        "marketplace_service" => Some(TitleJoin {
            table: "business_services".into(),
            label: "name".into(),
        }),
        "shared_item" => Some(TitleJoin { table: "shared_items".into(), label: "name".into() }),
        "library_item" => Some(TitleJoin {
            table: "learning_materials".into(),
            label: "title".into(),
        }),
        "hackathon" => Some(TitleJoin { table: "hackathons".into(), label: "title".into() }),
        _ => None,
    }
}

/// Lấy tiêu đề của một nhóm `target_id` cho một loại (query với `IN`).
/// Lỗi DB → trả về bản đồ rỗng (title giảm xuống `null`).
async fn title_lookup(
    pool: &sqlx::PgPool,
    target_type: &str,
    ids: &[String],
) -> Result<HashMap<String, String>, AppError> {
    let join = match title_join(target_type) {
        Some(join) => join,
        None => return Ok(HashMap::new()),
    };

    if ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<String> = ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    let sql = format!(
        r#"SELECT CAST(id AS TEXT) AS id, "{label}" AS title FROM "{table}"
             WHERE CAST(id AS TEXT) IN ({placeholders})"#,
        label = join.label,
        table = join.table,
        placeholders = placeholders.join(","),
    );

    let mut query = crate::db::query(&sql);
    for id in ids {
        query = query.bind(id);
    }

    let rows = match query.fetch_all(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(
                "Bookmark title lookup failed type={} (table={}): {}",
                target_type,
                join.table,
                e
            );
            return Ok(HashMap::new());
        }
    };

    let mut map = HashMap::new();
    for row in rows {
        map.insert(crate::db::text(&row, "id"), crate::db::text(&row, "title"));
    }

    Ok(map)
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_BOOKMARKS: &str = r#"
    SELECT "id", "user_id", "target_type", "target_id",
           CAST("created_at" AS TEXT) AS "created_at"
    FROM "bookmarks"
    WHERE "user_id" = $1
    ORDER BY "created_at" DESC
"#;

const DB_SELECT_EXISTING: &str = r#"
    SELECT 1 FROM "bookmarks"
    WHERE "user_id" = $1 AND "target_type" = $2 AND "target_id" = $3
"#;

const DB_INSERT_BOOKMARK: &str = r#"
    INSERT INTO "bookmarks" ("user_id", "target_type", "target_id", "created_at")
    VALUES ($1, $2, $3, NOW())
    RETURNING 1
"#;

const DB_DELETE_BOOKMARK: &str = r#"
    DELETE FROM "bookmarks"
    WHERE "user_id" = $1 AND "target_type" = $2 AND "target_id" = $3
"#;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/bookmarks?target_type=` — danh sách bookmark + tiêu đề (title
/// join cho mỗi loại). Trả về `{ items }`.
pub async fn list(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Query(_query): Query<ListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let rows = crate::db::query(DB_SELECT_BOOKMARKS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let items: Vec<BookmarkItem> = rows
        .into_iter()
        .map(|r| {
            BookmarkItem {
                target_type: crate::db::text(&r, "target_type"),
                target_id: crate::db::text(&r, "target_id"),
                created_at: crate::db::text(&r, "created_at"),
                title: None,
            }
        })
        .collect();

    // Nhóm theo `target_type` để lấy tiêu đề cho từng loại.
    let mut types: HashMap<String, Vec<String>> = HashMap::new();
    for item in &items {
        types
            .entry(item.target_type.clone())
            .or_default()
            .push(item.target_id.clone());
    }

    // Lỗi không làm 500: trả về `title: null` cho loại đó.
    let mut titles: HashMap<String, HashMap<String, String>> = HashMap::new();
    for (target_type, ids) in types {
        match title_lookup(pool.db(), &target_type, &ids).await {
            Ok(map) => {
                titles.insert(target_type, map);
            }
            Err(e) => {
                tracing::warn!("Bookmark title lookup failed: {e}");
                titles.insert(target_type, HashMap::new());
            }
        }
    }

    let jsons: Vec<Value> = items
        .iter()
        .map(|it| {
            let title = titles.get(&it.target_type).and_then(|m| m.get(&it.target_id));
            serde_json::json!({
                "target_type": it.target_type,
                "target_id": it.target_id,
                "title": title,
                "created_at": it.created_at,
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": jsons }))))
}

/// `POST /api/bookmarks` — toggle một bookmark (ưa/bỏ).
///
/// Body: `{ "target_type": "...", "target_id": "..." }`.
pub async fn toggle(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(form): Json<ToggleForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    if form.target_type.trim().is_empty() || form.target_id.trim().is_empty() {
        return Err(AppError::BadRequest(
            "target_type và target_id là bắt buộc.".to_string(),
        ));
    }

    let existing = crate::db::query(DB_SELECT_EXISTING)
        .bind(&user.id)
        .bind(&form.target_type)
        .bind(&form.target_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let bookmarked = existing.is_none();

    // `existing` is moved into the block by this match.
    match existing {
        Some(_row) => {
            crate::db::query(DB_DELETE_BOOKMARK)
                .bind(&user.id)
                .bind(&form.target_type)
                .bind(&form.target_id)
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
        }
        None => {
            crate::db::query(DB_INSERT_BOOKMARK)
                .bind(&user.id)
                .bind(&form.target_type)
                .bind(&form.target_id)
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
        }
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "bookmarked": bookmarked,
        "target_type": form.target_type,
        "target_id": form.target_id,
    }))))
}
