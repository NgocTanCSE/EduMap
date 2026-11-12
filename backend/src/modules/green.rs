//! Green module — `/api/green/*`: danh sách thử thách Sống Xanh, ghi nhận
//! hoạt động tham gia thử thách và thêm impact xanh.
//!
//! Routing table (applied by `Router::layer(AuthLayer)` in `router.rs`; các
//! danh sách là công khai, write handler tự kiểm JWT):
//!
//! ```text
//! GET  /api/green/impacts   -> public, danh sách impact xanh (từ challenge)
//! GET  /api/green/challenges -> public, thử thách đang active
//! POST /api/green/activities -> JWT, ghi nhận tham gia một thử thách
//! POST /api/green/impacts    -> JWT, tạo challenge/impact xanh mới
//! ```
//!
//! Mirrors `backend/src/modules/green/green.controller.ts` +
//! `green.service.ts`. `logActivity` ghi vào `green_challenge_activities`,
//! `addImpact` tạo bản ghi `green_challenges` — giữ nguyên hành vi old service.
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::State;
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// The logged-in user: the read endpoints are public (`PUBLIC_PATHS`), so the
/// write handlers pull the token themselves and answer `401` without one.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_CHALLENGES: &str = r#"
    SELECT CAST("gc"."id" AS TEXT) AS "id", "gc"."title", "gc"."description",
           "gc"."points_reward", "gc"."status",
           "gc"."lat", "gc"."lng", "gc"."address",
           CAST("gc"."created_at" AS TEXT) AS "created_at",
           COUNT("gca"."id") AS "participant_count"
    FROM "green_challenges" AS "gc"
    LEFT JOIN "green_challenge_activities" AS "gca"
           ON "gca"."challenge_id" = "gc"."id"
    WHERE "gc"."status" = 'active'
    GROUP BY "gc"."id", "gc"."title", "gc"."description", "gc"."points_reward",
             "gc"."status", "gc"."lat", "gc"."lng", "gc"."address",
             "gc"."created_at"
    ORDER BY "gc"."created_at" DESC
    "#;

const DB_LOG_ACTIVITY: &str = r#"
    INSERT INTO "green_challenge_activities"
        ("user_id", "challenge_id", "carbon_saved_kg", "points_earned", "created_at")
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING CAST("id" AS TEXT) AS "id", "user_id", CAST("challenge_id" AS TEXT) AS "challenge_id", "carbon_saved_kg", "points_earned",
            CAST("created_at" AS TEXT) AS "created_at"
"#;

const DB_CREATE_CHALLENGE: &str = r#"
    INSERT INTO "green_challenges"
        ("title", "description", "points_reward", "status", "created_by", "created_at")
    VALUES ($1, $2, $3, 'active', $4, NOW())
    RETURNING CAST("id" AS TEXT) AS "id", "title", "points_reward", CAST("created_at" AS TEXT) AS "created_at"
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn challenge_to_json(row: &sqlx::PgRow) -> Value {
    let points: i64 = row.get::<Option<i64>>("points_reward").unwrap_or(0);
    serde_json::json!({
        "id": row.get::<Option<String>>("id").unwrap_or_default(),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "points": points,
        "carbon_saved_kg": (points as f64) * 0.5,
        "participants_count": row.get::<Option<i64>>("participant_count").unwrap_or(0),
        "image_url": Value::Null,
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        "lat": row.get::<Option<f64>>("lat"),
        "lng": row.get::<Option<f64>>("lng"),
        "address": row.get::<Option<String>>("address"),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

fn impact_to_json(row: &sqlx::PgRow) -> Value {
    let points: i64 = row.get::<Option<i64>>("points_reward").unwrap_or(0);
    serde_json::json!({
        "id": row.get::<Option<String>>("id").unwrap_or_default(),
        "initiative": row.get::<Option<String>>("title").unwrap_or_default(),
        "carbonSavedKg": (points as f64) * 0.5,
        "date": row
            .get::<Option<String>>("created_at")
            .unwrap_or_default()
            .split('T')
            .next()
            .unwrap_or(""),
    })
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivityForm {
    challenge_id: String,
    carbon_saved_kg: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImpactForm {
    initiative: String,
    carbon_saved_kg: Option<f64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/green/impacts` — danh sách impact xanh (public).
pub async fn get_all_impacts(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_CHALLENGES)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let impacts: Vec<Value> = rows.iter().map(impact_to_json).collect();
    Ok(Json(ApiResponse::ok(impacts)))
}

/// `GET /api/green/challenges` — danh sách thử thách đang active, kèm số
/// người tham gia (public).
pub async fn get_challenges(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_CHALLENGES)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let challenges: Vec<Value> = rows.iter().map(challenge_to_json).collect();
    Ok(Json(ApiResponse::ok(challenges)))
}

/// `POST /api/green/activities` — ghi nhận hoạt động tham gia thử thách
/// Sống Xanh (JWT).
pub async fn log_activity(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<ActivityForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let carbon = body.carbon_saved_kg.unwrap_or(0.0);
    let points = (carbon * 2.0).round() as i64;

    let row = sqlx::query(DB_LOG_ACTIVITY)
        .bind(&user.id)
        .bind(&body.challenge_id)
        .bind(&carbon)
        .bind(&points)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "user_id": row.get::<String>("user_id"),
        "challenge_id": row.get::<String>("challenge_id"),
        "carbon_saved_kg": row.get::<Option<f64>>("carbon_saved_kg").unwrap_or(0.0),
        "points_earned": row.get::<Option<i64>>("points_earned").unwrap_or(0),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `POST /api/green/impacts` — thêm impact xanh mới (tạo thử thách, JWT).
pub async fn add_impact(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<ImpactForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let initiative = body.initiative.trim();
    if initiative.is_empty() {
        return Err(AppError::BadRequest("Tên impact/thử thách không được rỗng".to_string()));
    }

    let points = (body.carbon_saved_kg.unwrap_or(0.0) * 2.0).round() as i64;

    let row = sqlx::query(DB_CREATE_CHALLENGE)
        .bind(initiative)
        .bind("")
        .bind(&points)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(impact_to_json(&row))))
}