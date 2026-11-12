//! Community module — `/api/community/*`: study-group posts, comments, likes
//! and groups.
//!
//! Routing table (applied by `Router::layer(AuthLayer)` in `router.rs`; the
//! read endpoints are listed in `PUBLIC_PATHS` so guests can browse the
//! community, the write endpoints authenticate themselves and answer 401 when
//! the JWT is missing):
//!
//! ```text
//! GET  /api/community/posts            -> public, page/limit/search/group_id
//! POST /api/community/posts            -> JWT + AI moderation
//! GET  /api/community/posts/:id        -> public, status='active'
//! POST /api/community/posts/:id/like   -> JWT, like_count += 1
//! GET  /api/community/posts/:id/comments -> public, page/limit
//! POST /api/community/posts/:id/comments -> JWT + AI moderation + comment_count += 1
//! GET  /api/community/groups           -> public, deleted_at IS NULL
//! POST /api/community/groups           -> JWT
//! POST /api/community/groups/:id/join  -> JWT
//! ```
//!
//! Every piece of text written to the community is sent to the ai-service
/// content moderator (`POST /api/ai/moderate/`) before it is stored:
//
// - the ai-service is unreachable / times out → `503`
//   (`"Hệ thống kiểm duyệt AI đang tạm thời gián đoạn. Vui lòng thử lại sau."`);
// - the moderator returns anything but `action_taken = APPROVED` → `400`
//   (`"Nội dung vi phạm tiêu chuẩn cộng đồng: <flags>"`);
//
// Neither path may 502 the community page — the check happens *before* any
// write, so the database is never left half-updated.
//
// The notification sent to a post author on like/comment is fire-and-forget
// (`POST /api/notifications/send`); a failure is logged and swallowed, never
// propagated to the user.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use sqlx::PgPool;
use std::time::Duration;
use tracing::warn;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// The logged-in user: the read endpoints are public (`PUBLIC_PATHS`), so the
/// write handlers pull the token out of the request extensions themselves.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

/// Escape a single quote so a filter compiled into the SQL text cannot break
/// out of its string literal.
fn esc_sql(v: &str) -> String {
    v.replace('\'', "''")
}

// ---------------------------------------------------------------------------
// AI content moderation
// ---------------------------------------------------------------------------

const MODERATION_PATH: &str = "/api/ai/moderate/";
const MODERATION_UNAVAILABLE_MSG: &str =
    "Hệ thống kiểm duyệt AI đang tạm thời gián đoạn. Vui lòng thử lại sau.";
const MODERATION_REJECT_MSG: &str = "Nội dung vi phạm tiêu chuẩn cộng đồng";

/// Default endpoint of the notifications service (fire-and-forget).
fn notifications_url() -> String {
    std::env::var("NOTIFICATIONS_URL").unwrap_or_else(|_| "http://127.0.0.1:3000/api/notifications/send".to_string())
}

/// Send `text` to the ai-service content moderator and reject the write when
/// the content is not approved.
///
/// - ai-service unreachable / timeout / 5xx → `ServiceUnavailable` (503) with
///   the exact message the old `CommunityService::assertContentApproved` used.
/// - `action_taken != APPROVED` → `BadRequest` (400), listing the flags the
///   moderator returned.
async fn assert_content_approved(user_id: &str, text: &str) -> Result<Value, AppError> {
    let body = serde_json::json!({ "user_id": user_id, "text": text });
    match proxy_to_ai_service(MODERATION_PATH, body).await {
        Ok(result) => {
            let action = result.get("action_taken").and_then(Value::as_str).unwrap_or("");
            if action != "APPROVED" {
                let flags = result.get("flags").and_then(Value::as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(Value::as_str)
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_default();
                let detail = if flags.is_empty() {
                    MODERATION_REJECT_MSG.to_string()
                } else {
                    format!("{}: {}", MODERATION_REJECT_MSG, flags)
                };
                return Err(AppError::BadRequest(detail));
            }
            Ok(result)
        }
        // The ai-service is part of the same container but boots after the
        // backend; a cold start is not a user error, so answer 503 instead of
        // 502 and let the frontend surface a retryable message.
        Err(_) => Err(AppError::ServiceUnavailable(MODERATION_UNAVAILABLE_MSG.to_string())),
    }
}

/// Fire-and-forget a notification for a post author. The notification is a
/// nicety: if the notifications service is down (or not yet ported) the
// like/comment still succeeds — this may never turn a 200 into a 502.
fn notify_author(pg_pool: PgPool, author_id: String, message: String) {
    let url = notifications_url();
    tokio::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .connect_timeout(Duration::from_secs(3))
            .build()
        {
            Ok(c) => c,
            Err(_) => return,
        };
        let _ = client
            .post(&url)
            .json(&serde_json::json!({
                "userId": author_id,
                "message": message,
                "type": "in-app",
            }))
            .send()
            .await;
        // Best effort only; the write above is the contract, not this.
        if let Err(e) = sqlx::query(
            "INSERT INTO notifications (user_id, title, body, channel, is_read, sent_at) \
             VALUES ($1, $2, $3, 'in-app', false, NOW())",
        )
        .bind(&author_id)
        .bind(&message)
        .bind("")
        .execute(&pg_pool)
        .await
        {
            warn!("degraded notification could not be persisted: {e}");
        }
    });
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_POSTS: &str = r#"
    SELECT * FROM (
        SELECT p.id, p.author_id, p.group_id, p.title, p.content,
               CAST(p.media_urls AS TEXT) AS media_urls,
               CAST(p.tags AS TEXT) AS tags,
               p.like_count, p.comment_count, p.status, p.pinned,
               CAST(p.created_at AS TEXT) AS created_at,
               CAST(p.updated_at AS TEXT) AS updated_at,
               a.full_name AS author_name, a.avatar_url AS author_avatar, a.role AS author_role,
               g.name AS group_name, g.description AS group_description, g.id AS group_row_id
        FROM posts p
        LEFT JOIN users a ON a.id = p.author_id
        LEFT JOIN groups g ON g.id = p.group_id
        WHERE p.status = 'active' AND p.deleted_at IS NULL
    ) sub
"#;

const DB_SELECT_POST_BY_ID: &str = r#"
    SELECT p.id, p.author_id, p.group_id, p.title, p.content,
           CAST(p.media_urls AS TEXT) AS media_urls,
           CAST(p.tags AS TEXT) AS tags,
           p.like_count, p.comment_count, p.status, p.pinned,
           CAST(p.created_at AS TEXT) AS created_at,
           CAST(p.updated_at AS TEXT) AS updated_at,
           a.full_name AS author_name, a.avatar_url AS author_avatar, a.role AS author_role,
           g.name AS group_name, g.description AS group_description, g.id AS group_row_id
    FROM posts p
    LEFT JOIN users a ON a.id = p.author_id
    LEFT JOIN groups g ON g.id = p.group_id
    WHERE p.id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
"#;

const DB_SELECT_COMMENTS: &str = r#"
    SELECT c.id, c.post_id, c.author_id, c.content, c.like_count, c.status,
           CAST(c.created_at AS TEXT) AS created_at,
           CAST(c.updated_at AS TEXT) AS updated_at,
           a.full_name AS author_name, a.avatar_url AS author_avatar, a.role AS author_role
    FROM comments c
    LEFT JOIN users a ON a.id = c.author_id
    WHERE c.post_id = $1 AND c.status = 'active' AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
"#;

const DB_SELECT_GROUPS: &str = r#"
    SELECT id, name, description, avatar_url, cover_url, type,
           member_count, privacy, owner_id,
           CAST(created_at AS TEXT) AS created_at,
           CAST(updated_at AS TEXT) AS updated_at
    FROM groups
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
"#;

// ---------------------------------------------------------------------------
// JSON builders (mirror `relations: ['author', 'group']` of the old service)
// ---------------------------------------------------------------------------

fn author_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<Option<String>>("author_id").unwrap_or_default(),
        "full_name": row.get::<Option<String>>("author_name").unwrap_or_default(),
        "avatar_url": row.get::<Option<String>>("author_avatar").unwrap_or_default(),
        "role": row.get::<Option<String>>("author_role").unwrap_or_default(),
    })
}

fn group_to_json(row: &sqlx::PgRow) -> Value {
    let name: Option<String> = row.get::<Option<String>>("group_name");
    if name.as_deref().filter(|n| !n.trim().is_empty()).is_none() {
        return Value::Null;
    }
    serde_json::json!({
        "id": row.get::<Option<String>>("group_row_id").unwrap_or_default(),
        "name": name.unwrap_or_default(),
        "description": row.get::<Option<String>>("group_description").unwrap_or_default(),
    })
}

fn post_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "content": row.get::<Option<String>>("content").unwrap_or_default(),
        "author_id": row.get::<Option<String>>("author_id").unwrap_or_default(),
        "group_id": row.get::<Option<String>>("group_id").unwrap_or_default(),
        "media_urls": row.get::<Option<String>>("media_urls")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "tags": row.get::<Option<String>>("tags")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "like_count": row.get::<i64>("like_count"),
        "comment_count": row.get::<i64>("comment_count"),
        "status": row.get::<String>("status"),
        "pinned": row.get::<bool>("pinned"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
        "author": author_to_json(row),
        "group": group_to_json(row),
    })
}

fn comment_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "post_id": row.get::<String>("post_id"),
        "author_id": row.get::<String>("author_id"),
        "content": row.get::<String>("content"),
        "like_count": row.get::<i64>("like_count"),
        "status": row.get::<String>("status"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
        "author": serde_json::json!({
            "id": row.get::<String>("author_id"),
            "full_name": row.get::<Option<String>>("author_name").unwrap_or_default(),
            "avatar_url": row.get::<Option<String>>("author_avatar").unwrap_or_default(),
            "role": row.get::<Option<String>>("author_role").unwrap_or_default(),
        }),
    })
}

fn group_to_json_flat(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<Option<String>>("name").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct PostsQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub group_id: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct CommentsQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub title: String,
    pub content: String,
    pub group_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub description: Option<String>,
    pub avatar_url: Option<String>,
    pub cover_url: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub privacy: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/community/posts` — lấy danh sách các bài viết thảo luận.
pub async fn get_posts(
    State(pool): State<DbPool>,
    Query(q): Query<PostsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let mut filters: Vec<String> = Vec::new();
    if let Some(gid) = q.group_id.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!("group_id = '{}'", esc_sql(gid)));
    }
    if let Some(term) = q.search.as_ref().filter(|v| !v.trim().is_empty()) {
        let kw = esc_sql(term.trim());
        filters.push(format!(
            "(LOWER(title) LIKE LOWER('%{}%') OR LOWER(content) LIKE LOWER('%{}%'))",
            kw, kw
        ));
    }

    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!(" AND {}", filters.join(" AND "))
    };

    let total: i64 = sqlx::query(&format!(
        "SELECT COUNT(*) FROM posts WHERE status = 'active' AND deleted_at IS NULL{}",
        where_clause
    ))
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?
    .get::<i64>(0);

    let rows = sqlx::query(&format!(
        "{}{} ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        DB_SELECT_POSTS, where_clause
    ))
    .bind(&limit)
    .bind(&offset)
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;

    let posts: Vec<Value> = rows.iter().map(post_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "posts": posts,
        "total": total,
        "page": page,
        "limit": limit,
    }))))
}

/// `POST /api/community/posts` — đăng bài thảo luận mới (có kiểm duyệt AI).
pub async fn create_post(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreatePostRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // AI moderation first — nothing reaches the database if it is rejected.
    assert_content_approved(&user.id, &body.content).await?;

    let group_id = body
        .group_id
        .as_ref()
        .filter(|v| !v.trim().is_empty())
        .map(|v| v.as_str());

    let post_id: String = sqlx::query(
        "INSERT INTO posts (author_id, group_id, title, content, \
         like_count, comment_count, status, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, 0, 0, 'active', NOW(), NOW()) \
         RETURNING id",
    )
    .bind(&user.id)
    .bind(group_id)
    .bind(&body.title)
    .bind(&body.content)
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?
    .get::<String>("id");

    let row = sqlx::query(DB_SELECT_POST_BY_ID)
        .bind(&post_id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(post_to_json(&row))))
}

/// `GET /api/community/posts/:id` — lấy chi tiết một bài đăng.
pub async fn get_post_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_POST_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy bài viết".to_string())),
    };

    Ok(Json(ApiResponse::ok(post_to_json(&row))))
}

/// `POST /api/community/posts/:id/like` — thích một bài viết.
pub async fn like_post(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // The post must exist and be visible — mirror the old service's
    // `NotFoundException("Bài viết không tồn tại hoặc đã bị khóa")`.
    let visible: Option<i64> = sqlx::query(
        "SELECT 1 FROM posts WHERE id = $1 AND status = 'active' AND deleted_at IS NULL",
    )
    .bind(&id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?
    .map(|row| row.get::<i64>(0));

    if visible.is_none() {
        return Err(AppError::NotFound(
            "Bài viết không tồn tại hoặc đã bị khóa".to_string(),
        ));
    }

    sqlx::query("UPDATE posts SET like_count = like_count + 1 WHERE id = $1")
        .bind(&id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    // Notify the author only when the liker is someone else. Fire-and-forget:
    // a failed notification must not fail the like itself.
    let author: Option<String> = sqlx::query("SELECT author_id FROM posts WHERE id = $1")
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<String>("author_id"));

    if let Some(author_id) = author.filter(|a| a != user.id) {
        notify_author(
            pool.db().clone(),
            author_id,
            "Lượt thích mới! Ai đó vừa thích bài viết của bạn trong cộng đồng EduMap.".to_string(),
        );
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Đã thích bài viết",
    }))))
}

/// `GET /api/community/posts/:id/comments` — lấy danh sách bình luận.
pub async fn get_comments(
    State(pool): State<DbPool>,
    Path(post_id): Path<String>,
    Query(q): Query<CommentsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM comments WHERE post_id = $1 \
         AND status = 'active' AND deleted_at IS NULL",
    )
    .bind(&post_id)
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?
    .get::<i64>(0);

    let rows = sqlx::query(&format!("{} LIMIT $1 OFFSET $2", DB_SELECT_COMMENTS))
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let comments: Vec<Value> = rows.iter().map(comment_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "comments": comments,
        "total": total,
        "page": page,
        "limit": limit,
    }))))
}

/// `POST /api/community/posts/:id/comments` — thêm bình luận (có kiểm duyệt AI).
pub async fn add_comment(
    State(pool): State<DbPool>,
    req: Request,
    Path(post_id): Path<String>,
    Json(body): Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // The post must exist — mirror the old `NotFoundException`.
    let post_row = sqlx::query("SELECT id, author_id, title FROM posts WHERE id = $1 AND status = 'active' AND deleted_at IS NULL")
        .bind(&post_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let (post_id_db, author_id, title) = match post_row {
        Some(row) => (
            row.get::<String>("id"),
            row.get::<String>("author_id"),
            row.get::<Option<String>>("title").unwrap_or_default(),
        ),
        None => return Err(AppError::NotFound("Không tìm thấy bài viết".to_string())),
    };

    assert_content_approved(&user.id, &body.content).await?;

    let comment_id: String = sqlx::query(
        "INSERT INTO comments (post_id, author_id, content, status, created_at, updated_at) \
         VALUES ($1, $2, $3, 'active', NOW(), NOW()) \
         RETURNING id",
    )
    .bind(&post_id_db)
    .bind(&user.id)
    .bind(&body.content)
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?
    .get::<String>("id");

    sqlx::query("UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1")
        .bind(&post_id_db)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    if author_id != user.id {
        notify_author(
            pool.db().clone(),
            author_id,
            format!(
                "Bình luận mới! Bạn có một bình luận mới cho bài viết \"{}\".",
                title
            ),
        );
    }

    let row = sqlx::query(
        "SELECT c.id, c.post_id, c.author_id, c.content, c.like_count, c.status, \
                CAST(c.created_at AS TEXT) AS created_at, \
                CAST(c.updated_at AS TEXT) AS updated_at, \
                a.full_name AS author_name, a.avatar_url AS author_avatar, a.role AS author_role \
         FROM comments c \
         LEFT JOIN users a ON a.id = c.author_id \
         WHERE c.id = $1",
    )
    .bind(&comment_id)
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(comment_to_json(&row))))
}

/// `GET /api/community/groups` — lấy danh sách các nhóm học tập công cộng.
pub async fn get_groups(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_GROUPS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let groups: Vec<Value> = rows.iter().map(group_to_json_flat).collect();

    // The old service returned the array directly (`repo.find(...)`), so `data`
    // is the list itself, not `{ groups: [...] }`.
    Ok(Json(ApiResponse::ok(groups)))
}

/// `POST /api/community/groups` — tạo nhóm học tập mới.
pub async fn create_group(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreateGroupRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Tên nhóm không được rỗng".to_string()));
    }

    let group_id: String = sqlx::query(
        "INSERT INTO groups (name, description, avatar_url, cover_url, type, \
         member_count, privacy, owner_id, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7, NOW(), NOW()) \
         RETURNING id",
    )
    .bind(name)
    .bind(body.description.as_deref())
    .bind(body.avatar_url.as_deref())
    .bind(body.cover_url.as_deref())
    .bind(body.kind.as_deref())
    .bind(body.privacy.as_deref().unwrap_or("public"))
    .bind(&user.id)
    .fetch_one(pool.db())
    .await
    .map_err(AppError::from)?
    .get::<String>("id");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": group_id,
        "name": name,
        "owner_id": user.id,
    }))))
}

/// `POST /api/community/groups/:id/join` — tham gia nhóm học tập.
pub async fn join_group(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(&req)?;

    let name: Option<String> = sqlx::query("SELECT name FROM groups WHERE id = $1 AND deleted_at IS NULL")
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<String>("name"));

    let name = match name {
        Some(name) => name,
        None => return Err(AppError::NotFound("Không tìm thấy nhóm học tập".to_string())),
    };

    // There is no `group_members` table yet (the old service only returned the
    // message), so `member_count` is left untouched here.
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": format!("Đã tham gia nhóm học tập \"{}\" thành công!", name),
    }))))
}