//! Notifications module — `/api/notifications/*`: thông báo của người dùng
//! (tạo, danh sách, chi tiết theo id/người dùng, đánh dấu đã đọc).
//!
//! Mirrors `backend/src/modules/notifications/notifications.controller.ts` +
//! `notifications.service.ts`. Các endpoint cần JWT (`@UseGuards(JwtAuthGuard)`
//! ở old backend = `AuthLayer` của Rust backend).

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::notifications::hub;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, State};
use axum::Json;
use axum::response::sse::Event;
use futures::Stream;
use serde::Deserialize;
use serde_json::Value;
use std::convert::Infallible;


// ---------------------------------------------------------------------------
// Auth helpers (auth layer + admin role)
// ---------------------------------------------------------------------------


/// `admin` / `moderator` (tương đương `@Roles(ADMIN, MODERATOR)`).
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

const DB_SELECT_NOTIFICATION: &str = r#"
    SELECT id, user_id, title, body, channel, is_read,
           CAST(sent_at AS TEXT) AS sent_at,
           CAST(read_at AS TEXT) AS read_at
    FROM notifications WHERE id = $1
"#;

const DB_SELECT_USER_NOTIFICATIONS: &str = r#"
    SELECT id, user_id, title, body, channel, is_read,
           CAST(sent_at AS TEXT) AS sent_at,
           CAST(read_at AS TEXT) AS read_at
    FROM notifications WHERE user_id = $1
    ORDER BY sent_at DESC
"#;

const DB_SELECT_NOTIFICATIONS_BY_USER: &str = r#"
    SELECT id, user_id, title, body, channel, is_read,
           CAST(sent_at AS TEXT) AS sent_at,
           CAST(read_at AS TEXT) AS read_at
    FROM notifications WHERE user_id = $1
    ORDER BY sent_at DESC
"#;

const DB_INSERT_NOTIFICATION: &str = r#"
    INSERT INTO notifications (user_id, title, body, channel, is_read, sent_at)
    VALUES ($1, $2, $3, $4, false, NOW())
    RETURNING id, user_id, title, body, channel, is_read,
              CAST(sent_at AS TEXT) AS sent_at,
              CAST(read_at AS TEXT) AS read_at
"#;

// ---------------------------------------------------------------------------
// JSON builders (hơi giống `toView()` của old service)
// ---------------------------------------------------------------------------

fn notification_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "user_id": crate::db::text(&row, "user_id"),
        "title": crate::db::opt_text(&row, "title").unwrap_or_default(),
        "body": crate::db::opt_text(&row, "body").unwrap_or_default(),
        "channel": crate::db::opt_text(&row, "channel").unwrap_or_default(),
        "is_read": crate::db::flag(&row, "is_read"),
        "sent_at": crate::db::text(&row, "sent_at"),
        "read_at": crate::db::opt_text(&row, "read_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SendNotificationRequest {
    pub user_id: String,
    pub message: String,
    #[serde(default)]
    pub kind: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/notifications/send` — tạo một thông báo (email/in-app/push).
/// (`sync` fire-and-forget vào ai-service `POST /api/ai/...` không port; ở
/// đây tạo trực tiếp vào bảng `notifications`.)
pub async fn send_notification(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<SendNotificationRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    ensure_admin(&user)?;

    let kind = body.kind.trim();
    let kind = if kind.is_empty() {
        "in-app"
    } else {
        kind
    };

    // `message` fills both `title` + `body` (the old backend kept a single
    // `message` field for the notification text).
    let row = crate::db::query(DB_INSERT_NOTIFICATION)
        .bind(&body.user_id)
        .bind(&body.message)
        .bind(&body.message)
        .bind(kind)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    // Broadcast the new row through the hub (the SSE subscribers of that user).
    let payload = crate::common::notifications::Notification {
        id: crate::db::text(&row, "id"),
        user_id: crate::db::text(&row, "user_id"),
        title: crate::db::text(&row, "title"),
        body: crate::db::text(&row, "body"),
        channel: crate::db::text(&row, "channel"),
        sent_at: crate::db::text(&row, "sent_at"),
        data: None,
    };
    hub().notify_user(&payload.user_id, &payload).await;

    Ok(Json(ApiResponse::ok(notification_to_json(&row))))
}

/// `GET /api/notifications/subscribe` — server-sent events stream for the logged
/// in user: every newly created notification (the `send` endpoint above, or any
/// module calling `hub().notify_user()`) is pushed as a JSON event into the
/// stream of that user's windows.
///
/// The hub is registered in `main.rs`; dead streams are dropped by the broadcast
/// itself, so the hub never grows.
pub async fn subscribe_sse(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
) -> Result<axum::response::sse::Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    crate::common::notifications::subscribe_sse(State(pool), user).await
}

/// `GET /api/notifications` — danh sách thông báo của người gọi + số lượng
/// chưa đọc (đồng nhất với `PersonalNotifications` — `data.notifications` +
/// `data.unread_count`).
pub async fn get_my_notifications(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let rows = crate::db::query(DB_SELECT_USER_NOTIFICATIONS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let notifications: Vec<Value> = rows.iter().map(notification_to_json).collect();
    let unread_count: i64 =
        rows.iter().filter(|row| !crate::db::flag(&row, "is_read")).count() as i64;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "notifications": notifications,
        "unread_count": unread_count,
    }))))
}

/// `GET /api/notifications/{userId}` — thông báo của một người dùng khác
/// (master/admin).
pub async fn get_notifications_for_user(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(user_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    // Chỉ chủ sở hữu / admin / super_admin được đọc thông báo của người khác.
    if user.id != user_id
        && user.role != "admin"
        && user.role != "super_admin"
        && user.role != "moderator"
    {
        return Err(AppError::Forbidden(
            "Bạn không có quyền truy cập thông báo của người dùng khác.".to_string(),
        ));
    }

    let rows = crate::db::query(DB_SELECT_NOTIFICATIONS_BY_USER)
        .bind(&user_id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let notifications: Vec<Value> = rows.iter().map(notification_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::Value::Array(notifications))))
}

/// `PUT /api/notifications/{id}/read` — đánh dấu một thông báo là đã đọc.
pub async fn mark_as_read(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    // Chỉ chủ sở hữu hoặc admin/moderator mới cập nhật được.
    let owner: Option<String> = crate::db::query("SELECT user_id FROM notifications WHERE id = $1")
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| crate::db::text(&row, "user_id"));

    match owner {
        Some(owner_id)
            if owner_id != user.id
                && user.role != "admin"
                && user.role != "super_admin"
                && user.role != "moderator" =>
        {
            return Err(AppError::Forbidden(
                "Bạn không có quyền cập nhật thông báo của người dùng khác.".to_string(),
            ));
        }
        _ => {}
    }

    let _row = match crate::db::query("UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 RETURNING id")
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
    {
        Some(r) => r,
        None => {
            return Err(AppError::NotFound(
                "Thông báo không tồn tại.".to_string(),
            ))
        }
    };

    let row = crate::db::query(DB_SELECT_NOTIFICATION)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(notification_to_json(&row))))
}
