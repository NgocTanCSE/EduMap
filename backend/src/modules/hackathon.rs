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

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, State};
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


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
    VALUES ($1,$2::uuid,$3,$4,'registered',NOW())
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

fn hackathon_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "title": crate::db::opt_text(&row, "title").unwrap_or_default(),
        "description": crate::db::opt_text(&row, "description").unwrap_or_default(),
        "start_date": crate::db::opt_text(&row, "start_date"),
        "end_date": crate::db::opt_text(&row, "end_date"),
        "status": crate::db::opt_text(&row, "status").unwrap_or_else(|| "upcoming".to_string()),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
    })
}

fn team_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "team_name": crate::db::opt_text(&row, "team_name").unwrap_or_default(),
        "hackathon_id": crate::db::opt_text(&row, "hackathon_id").unwrap_or_default(),
        "leader_id": crate::db::opt_text(&row, "leader_id").unwrap_or_default(),
        "members": crate::db::text_list(&row, "members"),
        "repo_url": crate::db::opt_text(&row, "repo_url"),
        "demo_video": crate::db::opt_text(&row, "demo_video"),
        "status": crate::db::opt_text(&row, "status").unwrap_or_else(|| "registered".to_string()),
        "score": crate::db::opt_num(&row, "score"),
        "feedback": crate::db::opt_text(&row, "feedback"),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterTeamForm {
    hackathon_id: String,
    team_name: String,
    members: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitProjectForm {
    repo_url: String,
    demo_video: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ScoreItem {
    criteria: String,
    score: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JudgeProjectForm {
    scores: Vec<ScoreItem>,
    feedback: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/hackathons` — lấy danh sách các cuộc thi Hackathon (public).
pub async fn get_hackathons(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = crate::db::query(DB_HACKATHONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let hackathons: Vec<Value> = rows.iter().map(hackathon_to_json).collect();
    Ok(Json(ApiResponse::ok(serde_json::Value::Array(hackathons))))
}

/// `GET /api/hackathons/:id` — lấy chi tiết một cuộc thi Hackathon (public).
pub async fn get_hackathon_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_HACKATHON_BY_ID)
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
    user: Option<Extension<AuthUser>>,
    Json(body): Json<RegisterTeamForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let hackathon = crate::db::query(DB_HACKATHON_BY_ID)
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

    let valid: Vec<String> = crate::db::query(DB_VALID_MEMBER_EMAILS)
        .bind(&body.members)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .into_iter()
        .map(|row| crate::db::text(&row, "email"))
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

    let existing: Option<i64> = crate::db::query(DB_EXISTING_TEAM_LEADER)
        .bind(&body.hackathon_id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<i64, usize>(0));

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Bạn đã là trưởng nhóm của một đội thi trong cuộc thi này rồi.".to_string(),
        ));
    }

    let row = crate::db::query(DB_REGISTER_TEAM)
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
    user: Option<Extension<AuthUser>>,
    Path(team_id): Path<String>,
    Json(body): Json<SubmitProjectForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let row = crate::db::query(DB_SUBMIT_TEAM)
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
            let team = crate::db::query(DB_TEAM_BY_ID_AND_LEADER)
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
            "team_name": crate::db::opt_text(&row, "team_name").unwrap_or_default(),
            "repo_url": crate::db::opt_text(&row, "repo_url"),
            "demo_video": crate::db::opt_text(&row, "demo_video"),
            "submitted_at": crate::db::opt_text(&row, "submitted_at")
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
        },
    }))))
}

/// `POST /api/hackathons/teams/:teamId/judge` — ban giám khảo chấm điểm dự
/// án của đội thi (JWT).
pub async fn judge_project(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(team_id): Path<String>,
    Json(body): Json<JudgeProjectForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;

    if body.scores.is_empty() {
        return Err(AppError::BadRequest("Cần ít nhất một tiêu chí chấm điểm".to_string()));
    }

    let total_score: f64 = body.scores.iter().map(|s| s.score).sum();
    let feedback = body.feedback.as_deref().unwrap_or("Chấm điểm bởi Hội đồng Ban Giám Khảo");

    let row = crate::db::query(DB_JUDGE_TEAM)
        .bind(&total_score)
        .bind(feedback)
        .bind(&team_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => {
            let team = crate::db::query(DB_TEAM_BY_ID)
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
        "team_name": crate::db::opt_text(&row, "team_name").unwrap_or_default(),
        "total_score": total_score,
        "feedback": crate::db::opt_text(&row, "feedback").unwrap_or_else(|| feedback.to_string()),
        "status": "judged",
    }))))
}