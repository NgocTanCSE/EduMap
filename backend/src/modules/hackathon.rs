//! Hackathon module — `/api/hackathons/*`: danh sách cuộc thi Hackathon, chi
//! tiết, đăng ký đội thi, nộp sản phẩm và chấm điểm.
//!
//! Routing table (applied by `Router::layer(AuthLayer)` in `router.rs`; danh
//! sách/chi tiết là công khai, write handler tự kiểm JWT):
//!
//! ```text
//! GET  /api/hackathons                   -> public, danh sách cuộc thi
//! GET  /api/hackathons/:id               -> public, chi tiết một cuộc thi
//! POST /api/hackathons/register          -> JWT, đăng ký đội thi mới
//! POST /api/hackathons/teams/:teamId/submit -> JWT, nộp sản phẩm (leader)
//! POST /api/hackathons/teams/:teamId/judge  -> JWT, chấm điểm đội thi
//! ```
//!
//! Mirrors `backend/src/modules/hackathon/hackathon.controller.ts` +
//! `hackathon.service.ts`. `/api/hackathons` được frontend BFF gọi trực tiếp
//! (và ghép với Devpost khi có kết nối).
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, State};
use axum::http::Request;
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// The logged-in user: the public endpoints don't get an `AuthUser` from the
/// router, so every handler pulls the token out of the request extensions
/// itself and answers `401` when the JWT is missing.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_HACKATHONS: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "title", "description",
           CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           "status", CAST("created_at" AS TEXT) AS "created_at"
    FROM "hackathons"
    ORDER BY "start_date" DESC
"#;

const DB_HACKATHON_BY_ID: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "title", "description",
           CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           "status", CAST("created_at" AS TEXT) AS "created_at"
    FROM "hackathons"
    WHERE "id" = $1
"#;

const DB_VALID_MEMBER_EMAILS: &str = r#"
    SELECT "email" FROM "users" WHERE "email" = ANY($1)
"#;

const DB_EXISTING_TEAM_LEADER: &str = r#"
    SELECT 1 FROM "hackathon_teams"
    WHERE "hackathon_id" = $1 AND "leader_id" = $2
"#;

const DB_REGISTER_TEAM: &str = r#"
    INSERT INTO "hackathon_teams"
        ("team_name", "hackathon_id", "leader_id", "members", "status", "created_at")
    VALUES ($1, $2, $3, $4, 'registered', NOW())
    RETURNING CAST("id" AS TEXT) AS "id", "team_name", "hackathon_id", "leader_id", "members", "status",
            CAST("created_at" AS TEXT) AS "created_at"
"#;

const DB_TEAM_BY_ID_AND_LEADER: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "team_name", "hackathon_id", "leader_id", "members",
           "repo_url", "demo_video", "score", "feedback", "status",
           CAST("created_at" AS TEXT) AS "created_at"
    FROM "hackathon_teams"
    WHERE "id" = $1 AND "leader_id" = $2
"#;

const DB_TEAM_BY_ID: &str = r#"
    SELECT CAST("id" AS TEXT) AS "id", "team_name", "hackathon_id", "leader_id", "members",
           "repo_url", "demo_video", "score", "feedback", "status",
           CAST("created_at" AS TEXT) AS "created_at"
    FROM "hackathon_teams"
    WHERE "id" = $1
"#;

const DB_SUBMIT_TEAM: &str = r#"
    UPDATE "hackathon_teams"
    SET "repo_url" = $1, "demo_video" = $2, "status" = 'submitted'
    WHERE "id" = $3 AND "leader_id" = $4
    RETURNING CAST("id" AS TEXT) AS "id", "team_name", "repo_url", "demo_video",
            CAST("created_at" AS TEXT) AS "submitted_at", "status"
"#;

const DB_JUDGE_TEAM: &str = r#"
    UPDATE "hackathon_teams"
    SET "score" = $1, "feedback" = $2, "status" = 'judged'
    WHERE "id" = $3 AND "status" = 'submitted'
    RETURNING CAST("id" AS TEXT) AS "id", "team_name", "score", "feedback", "status"
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn hackathon_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "start_date": row.get::<Option<String>>("start_date"),
        "end_date": row.get::<Option<String>>("end_date"),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "upcoming".to_string()),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

fn team_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "team_name": row.get::<Option<String>>("team_name").unwrap_or_default(),
        "hackathon_id": row.get::<Option<String>>("hackathon_id").unwrap_or_default(),
        "leader_id": row.get::<Option<String>>("leader_id").unwrap_or_default(),
        "members": row.get::<Option<Vec<String>>>("members").unwrap_or_default(),
        "repo_url": row.get::<Option<String>>("repo_url"),
        "demo_video": row.get::<Option<String>>("demo_video"),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "registered".to_string()),
        "score": row.get::<Option<f64>>("score"),
        "feedback": row.get::<Option<String>>("feedback"),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterTeamForm {
    hackathon_id: String,
    team_name: String,
    members: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitProjectForm {
    repo_url: String,
    demo_video: String,
}

#[derive(Debug, Deserialize)]
struct ScoreItem {
    criteria: String,
    score: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JudgeProjectForm {
    scores: Vec<ScoreItem>,
    feedback: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/hackathons` — lấy danh sách các cuộc thi Hackathon (public).
pub async fn get_hackathons(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_HACKATHONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let hackathons: Vec<Value> = rows.iter().map(hackathon_to_json).collect();
    Ok(Json(ApiResponse::ok(hackathons)))
}

/// `GET /api/hackathons/:id` — lấy chi tiết một cuộc thi Hackathon (public).
pub async fn get_hackathon_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_HACKATHON_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc thi Hackathon".to_string())),
    };

    Ok(Json(ApiResponse::ok(hackathon_to_json(&row))))
}

/// `POST /api/hackathons/register` — đăng ký đội thi tham dự Hackathon mới
/// (JWT).
pub async fn register_team(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<RegisterTeamForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let hackathon = sqlx::query(DB_HACKATHON_BY_ID)
        .bind(&body.hackathon_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let hackathon = match hackathon {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc thi Hackathon".to_string())),
    };

    let status: Option<String> = hackathon.get("status");
    if status.as_deref() == Some("completed") {
        return Err(AppError::BadRequest(
            "Cuộc thi này đã kết thúc, không thể đăng ký thêm.".to_string(),
        ));
    }

    let team_name = body.team_name.trim();
    if team_name.is_empty() {
        return Err(AppError::BadRequest("Tên đội thi không được rỗng".to_string()));
    }

    if body.members.len() < 2 || body.members.len() > 4 {
        return Err(AppError::BadRequest(
            "Số lượng thành viên không hợp lệ. Đội thi phải có từ 3 đến 5 người (bao gồm cả trưởng nhóm). Vui lòng nhập từ 2 đến 4 email thành viên.".to_string(),
        ));
    }

    let valid: Vec<String> = sqlx::query(DB_VALID_MEMBER_EMAILS)
        .bind(&body.members)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .into_iter()
        .map(|row| row.get::<String>("email"))
        .collect();

    if valid.len() != body.members.len() {
        let invalid: Vec<String> = body
            .members
            .iter()
            .filter(|m| !valid.contains(*m))
            .cloned()
            .collect();
        return Err(AppError::BadRequest(format!(
            "Các email sau không tồn tại trong hệ thống EduMap: {}",
            invalid.join(", ")
        )));
    }

    let existing: Option<i64> = sqlx::query(DB_EXISTING_TEAM_LEADER)
        .bind(&body.hackathon_id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64>(0));

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Bạn đã là trưởng nhóm của một đội thi trong cuộc thi này rồi.".to_string(),
        ));
    }

    let row = sqlx::query(DB_REGISTER_TEAM)
        .bind(team_name)
        .bind(&body.hackathon_id)
        .bind(&user.id)
        .bind(&body.members)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(team_to_json(&row))))
}

/// `POST /api/hackathons/teams/:teamId/submit` — nộp sản phẩm dự thi (repo,
/// demo video) của đội — chỉ trưởng nhóm được nộp (JWT).
pub async fn submit_project(
    State(pool): State<DbPool>,
    req: Request,
    Path(team_id): Path<String>,
    Json(body): Json<SubmitProjectForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_SUBMIT_TEAM)
        .bind(&body.repo_url)
        .bind(&body.demo_video)
        .bind(&team_id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => {
            let team = sqlx::query(DB_TEAM_BY_ID_AND_LEADER)
                .bind(&team_id)
                .bind(&user.id)
                .fetch_optional(pool.db())
                .await
                .map_err(AppError::from)?;
            if team.is_none() {
                return Err(AppError::NotFound(
                    "Không tìm thấy đội thi tương ứng hoặc bạn không phải là Trưởng nhóm".to_string(),
                ));
            }
            return Err(AppError::BadRequest(
                "Đội thi chưa nộp bài, không thể nộp thêm.".to_string(),
            ));
        }
    };

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Nộp bài dự thi thành công! Vui lòng chờ Ban giám khảo chấm điểm.",
        "submission": {
            "team_name": row.get::<Option<String>>("team_name").unwrap_or_default(),
            "repo_url": row.get::<Option<String>>("repo_url"),
            "demo_video": row.get::<Option<String>>("demo_video"),
            "submitted_at": row
                .get::<Option<String>>("submitted_at")
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
        },
    }))))
}

/// `POST /api/hackathons/teams/:teamId/judge` — ban giám khảo chấm điểm dự
/// án của đội thi (JWT).
pub async fn judge_project(
    State(pool): State<DbPool>,
    req: Request,
    Path(team_id): Path<String>,
    Json(body): Json<JudgeProjectForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(&req)?;

    if body.scores.is_empty() {
        return Err(AppError::BadRequest("Cần ít nhất một tiêu chí chấm điểm".to_string()));
    }

    let total_score: f64 = body.scores.iter().map(|s| s.score).sum();
    let feedback = body.feedback.as_deref().unwrap_or("Chấm điểm bởi Hội đồng Ban Giám Khảo");

    let row = sqlx::query(DB_JUDGE_TEAM)
        .bind(&total_score)
        .bind(feedback)
        .bind(&team_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => {
            let team = sqlx::query(DB_TEAM_BY_ID)
                .bind(&team_id)
                .fetch_optional(pool.db())
                .await
                .map_err(AppError::from)?;
            if team.is_none() {
                return Err(AppError::NotFound(
                    "Không tìm thấy đội thi dự thi để chấm điểm".to_string(),
                ));
            }
            return Err(AppError::BadRequest(
                "Đội thi chưa nộp bài, không thể chấm điểm.".to_string(),
            ));
        }
    };

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Chấm điểm dự án thành công!",
        "team_name": row.get::<Option<String>>("team_name").unwrap_or_default(),
        "total_score": total_score,
        "feedback": row.get::<Option<String>>("feedback").unwrap_or_else(|| feedback.to_string()),
        "status": "judged",
    }))))
}