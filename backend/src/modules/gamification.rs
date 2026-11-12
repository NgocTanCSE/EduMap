//! Gamification module — `/api/gamification/*`: bảng xếp hạng, tiến độ cá
//! nhân, huy hiệu, nộp hoạt động xanh và cấp điểm/huy hiệu bởi admin.
//!
//! Routing table (applied by `Router::layer(AuthLayer)` in `router.rs`;
//! `leaderboard` là công khai, các endpoint khác tự kiểm JWT):
//!
//! ```text
//! GET  /api/gamification/leaderboard         -> public, top 10 theo điểm
//! GET  /api/gamification/my-progress         -> JWT, tiến độ + hạng của mình
//! GET  /api/gamification/my-badges           -> JWT, danh sách huy hiệu
//! POST /api/gamification/submit-activity     -> JWT, nộp hoạt động xanh (+50đ)
//! GET  /api/gamification/progress/:userId    -> JWT, tiến độ user khác
//! POST /api/gamification/grant-points       -> JWT + admin/mod, cộng điểm
//! POST /api/gamification/grant-achievement  -> JWT + admin/mod, cấp huy hiệu
//! ```
//!
//! Mirrors `backend/src/modules/gamification/gamification.controller.ts` +
//! `gamification.service.ts`. Các write handler tự lấy `AuthUser` từ request
//! và trả `401` khi thiếu token; `grant-*` kiểm vai trò (`admin`/`moderator`),
//! `progress/:userId` chỉ cho phép chủ tài khoản hoặc staff.
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::Request<Body>;
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// The logged-in user: gamification reads are mostly JWT-only, so every handler
/// pulls the token out of the request extensions itself.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

/// `admin` / `moderator` only (`@Roles(ADMIN, MODERATOR)` trong old backend).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

/// Staff (admin / moderator / super_admin) được xem tiến độ của người khác.
fn is_staff(user: &AuthUser) -> bool {
    matches!(user.role.as_str(), "admin" | "moderator" | "super_admin")
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_LEADERBOARD: &str = r#"
    SELECT CAST("up"."user_id" AS TEXT) AS "user_id",
           SUM("up"."points") AS "points",
           "u"."full_name",
           "u"."avatar_url"
    FROM "user_points" AS "up"
    LEFT JOIN "users" AS "u" ON "u"."id" = "up"."user_id"
    GROUP BY "up"."user_id", "u"."full_name", "u"."avatar_url"
    ORDER BY "points" DESC
    LIMIT 10
"#;

const DB_USER_POINTS_SUM: &str = r#"
    SELECT COALESCE(SUM("points"), 0) AS "total"
    FROM "user_points"
    WHERE "user_id" = $1
"#;

const DB_USER_RANK_ABOVE: &str = r#"
    SELECT COUNT(*) AS "higher"
    FROM (
        SELECT "user_id"
        FROM "user_points"
        GROUP BY "user_id"
        HAVING SUM("points") > $1
    ) AS "above"
"#;

const DB_USER_RANK_TOTAL: &str = r#"
    SELECT COUNT(DISTINCT "user_id") AS "total" FROM "user_points"
"#;

const DB_USER_BADGES: &str = r#"
    SELECT CAST("ub"."id" AS TEXT) AS "id",
           CAST("ub"."badge_id" AS TEXT) AS "badge_id",
           "b"."name",
           "b"."category",
           "b"."rarity",
           CAST("ub"."earned_at" AS TEXT) AS "earned_at"
    FROM "user_badges" AS "ub"
    JOIN "badges" AS "b" ON "b"."id" = "ub"."badge_id"
    WHERE "ub"."user_id" = $1
    ORDER BY "ub"."earned_at" DESC
"#;

const DB_BADGE_BY_NAME: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id" FROM "badges" WHERE "name" = $1
"#;

const DB_CREATE_BADGE: &str = r#"
    INSERT INTO "badges" ("name", "description", "category", "points_criteria", "rarity", "created_at")
    VALUES ($1, '', 'general', 0, 'common', NOW())
    RETURNING CAST("id" AS TEXT) AS "id"
"#;

const DB_GRANT_BADGE: &str = r#"
    INSERT INTO "user_badges" ("user_id", "badge_id", "earned_at")
    VALUES ($1, $2, NOW())
    ON CONFLICT ("user_id", "badge_id") DO NOTHING
"#;

const DB_AWARD_POINTS: &str = r#"
    INSERT INTO "user_points"
        ("user_id", "points", "action", "source_type", "source_id", "created_at")
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT ("user_id", "action", "source_id") DO NOTHING
"#;

const DB_SUBMIT_ACTIVITY: &str = r#"
    INSERT INTO "green_activities"
        ("user_id", "activity_type", "description", "proof_url", "status", "ai_confidence", "created_at", "updated_at")
    VALUES ($1, $2, $3, $4, 'pending', 0, NOW(), NOW())
    RETURNING CAST("id" AS TEXT) AS "id"
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn progress_json(user_id: &str, total: i64, badge_names: Vec<String>) -> Value {
    let level = (total / 100) + 1;
    serde_json::json!({
        "userId": user_id,
        "points": total,
        "level": level,
        "next_level_points": level * 100,
        "progress_percent": total % 100,
        "points_needed": 100 - (total % 100),
        "achievements": badge_names,
    })
}

fn progress_with_rank(user_id: &str, total: i64, rank: i64, total_users: i64, badge_names: Vec<String>) -> Value {
    let base = progress_json(user_id, total, badge_names);
    let mut out = BTreeMap::new();
    for (k, v) in base.as_object().unwrap() {
        out.insert(k.clone(), v.clone());
    }
    out.insert("rank".into(), rank.into());
    out.insert("total_users".into(), total_users.into());
    Value::Object(out)
}

fn badge_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<Option<String>>("id").unwrap_or_default(),
        "badge_id": row.get::<Option<String>>("badge_id").unwrap_or_default(),
        "name": row.get::<Option<String>>("name").unwrap_or_default(),
        "category": row.get::<Option<String>>("category").unwrap_or_default(),
        "rarity": row.get::<Option<String>>("rarity").unwrap_or_default(),
        "earned_at": row.get::<Option<String>>("earned_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Cộng điểm cho một người dùng (dùng chung bởi submit/grant/đăng ký sự kiện).
/// `reference_id` để tránh cộng trùng khi một hoạt động được gửi hai lần.
async fn award_points(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: &str,
    points: i64,
    action: &str,
    reference_id: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(DB_AWARD_POINTS)
        .bind(user_id)
        .bind(&points)
        .bind(action)
        .bind("gamification")
        .bind(reference_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

/// Lấy tổng điểm + danh sách huy hiệu của một người dùng.
async fn fetch_progress(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> Result<(i64, Vec<String>), AppError> {
    let sum: Option<i64> = sqlx::query(DB_USER_POINTS_SUM)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>("total"));
    let total = sum.unwrap_or(0);

    let rows = sqlx::query(DB_USER_BADGES)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::from)?;
    let badges: Vec<String> = rows
        .iter()
        .map(|r| r.get::<Option<String>>("name").unwrap_or_default())
        .collect();
    Ok((total, badges))
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitActivityForm {
    activity_type: Option<String>,
    description: Option<String>,
    proof_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrantPointsForm {
    user_id: String,
    points: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrantAchievementForm {
    user_id: String,
    achievement: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/gamification/leaderboard` — bảng xếp hạng 10 người dẫn đầu
/// (public).
pub async fn get_leaderboard(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_LEADERBOARD)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let users: Vec<Value> = rows
        .iter()
        .map(|r| {
            let points: i64 = r.get::<Option<i64>>("points").unwrap_or(0);
            serde_json::json!({
                "id": r.get::<Option<String>>("user_id").unwrap_or_default(),
                "full_name": r.get::<Option<String>>("full_name").unwrap_or_else(|| "Người dùng".to_string()),
                "avatar_url": r.get::<Option<String>>("avatar_url").unwrap_or_default(),
                "points": points,
                "level": (points / 100) + 1,
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(users)))
}

/// `GET /api/gamification/my-progress` — tiến độ, hạng và huy hiệu của
/// người dùng đăng nhập (JWT).
pub async fn get_my_progress(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let (total, badges) = fetch_progress(pool.db(), &user.id).await?;

    let higher: Option<i64> = sqlx::query(DB_USER_RANK_ABOVE)
        .bind(&total)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>("higher"));
    let rank = higher.unwrap_or(0) + 1;

    let total_users: Option<i64> = sqlx::query(DB_USER_RANK_TOTAL)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>("total"));

    Ok(Json(ApiResponse::ok(progress_with_rank(
        &user.id,
        total,
        rank,
        total_users.unwrap_or(0),
        badges,
    ))))
}

/// `GET /api/gamification/my-badges` — danh sách huy hiệu đã nhận (JWT).
pub async fn get_user_badges(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_USER_BADGES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let badges: Vec<Value> = rows.iter().map(badge_to_json).collect();
    Ok(Json(ApiResponse::ok(badges)))
}

/// `POST /api/gamification/submit-activity` — nộp hoạt động xanh
/// (activityType + proofUrl bắt buộc), trạng thái `pending` và cộng 50 điểm.
pub async fn submit_activity(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<SubmitActivityForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let activity_type = body.activity_type.as_deref().filter(|v| !v.trim().is_empty());
    let proof_url = body.proof_url.as_deref().filter(|v| !v.trim().is_empty());

    if activity_type.is_none() || proof_url.is_none() {
        return Err(AppError::BadRequest(
            "activityType và proofUrl là bắt buộc".to_string(),
        ));
    }

    let mut tx = pool.db().begin().await.map_err(AppError::from)?;

    let activity: Option<i64> = sqlx::query(DB_SUBMIT_ACTIVITY)
        .bind(&user.id)
        .bind(activity_type.unwrap())
        .bind(body.description.as_deref().unwrap_or(""))
        .bind(proof_url.unwrap())
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>("id"));

    if activity.is_none() {
        let _ = tx.rollback().await;
        return Err(AppError::Internal("Không thể lưu hoạt động".to_string()));
    }

    award_points(
        &mut tx,
        &user.id,
        50,
        &format!("GREEN_{}", activity_type.unwrap()),
        None,
    )
    .await?;

    tx.commit().await.map_err(AppError::from)?;

    let (total, badges) = fetch_progress(pool.db(), &user.id).await?;
    Ok(Json(ApiResponse::ok(progress_json(&user.id, total, badges))))
}

/// `GET /api/gamification/progress/:userId` — tiến độ của một người dùng
/// khác (chủ tài khoản hoặc staff mới được xem).
pub async fn get_user_progress(
    State(pool): State<DbPool>,
    req: Request,
    Path(user_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if user.id != user_id && !is_staff(&user) {
        return Err(AppError::Forbidden(
            "Bạn chỉ có thể xem tiến độ của chính mình.".to_string(),
        ));
    }

    let (total, badges) = fetch_progress(pool.db(), &user_id).await?;
    if total == 0 {
        // Keep parity with the old NotFoundException behaviour when there is
        // genuinely no row, but a zero sum is a valid (empty) progress.
    }

    Ok(Json(ApiResponse::ok(progress_json(&user_id, total, badges))))
}

/// `POST /api/gamification/grant-points` — cộng điểm thủ công (admin/mod).
pub async fn grant_points(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<GrantPointsForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    if body.points == 0 {
        return Err(AppError::BadRequest("Điểm cộng phải khác 0".to_string()));
    }

    let mut tx = pool.db().begin().await.map_err(AppError::from)?;
    award_points(
        &mut tx,
        &body.user_id,
        body.points,
        "ADMIN_GRANT",
        Some(&format!("{}-by-{}", user.id, Utc::now().timestamp_millis())),
    )
    .await?;
    tx.commit().await.map_err(AppError::from)?;

    let (total, badges) = fetch_progress(pool.db(), &body.user_id).await?;
    Ok(Json(ApiResponse::ok(progress_json(&body.user_id, total, badges))))
}

/// `POST /api/gamification/grant-achievement` — cấp huy hiệu thủ công
/// (admin/mod); tạo huy hiệu mới nếu tên chưa tồn tại.
pub async fn grant_achievement(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<GrantAchievementForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    if body.achievement.trim().is_empty() {
        return Err(AppError::BadRequest("Tên huy hiệu không được rỗng".to_string()));
    }

    let mut tx = pool.db().begin().await.map_err(AppError::from)?;

    let badge_row = sqlx::query(DB_BADGE_BY_NAME)
        .bind(body.achievement.trim())
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?;

    let badge_id: String = match badge_row {
        Some(row) => row.get::<String>("id"),
        None => {
            let inserted = sqlx::query(DB_CREATE_BADGE)
                .bind(body.achievement.trim())
                .execute(&mut *tx)
                .await
                .map_err(AppError::from)?;
            inserted.get("id")
        }
    };

    sqlx::query(DB_GRANT_BADGE)
        .bind(&body.user_id)
        .bind(&badge_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

    tx.commit().await.map_err(AppError::from)?;

    let (total, badges) = fetch_progress(pool.db(), &body.user_id).await?;
    Ok(Json(ApiResponse::ok(progress_json(&body.user_id, total, badges))))
}