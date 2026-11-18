//! Survey module — `/api/surveys/*`: khảo sát ý kiến của người dùng (tạo,
//! nộp, phân tích, xuất dữ liệu).
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; các
//! endpoint đọc là public, các handler write tự xác thực `@UseGuards
//! (JwtAuthGuard)` cũ và trả `401` khi JWT thiếu):
//!
//! ```text
//! GET  /api/surveys                -> public, danh sách khảo sát đang hoạt động
//! GET  /api/surveys/:id            -> public, chi tiết khảo sát
//! POST /api/surveys                -> JWT, tạo khảo sát mới
//! POST /api/surveys/:id/submit     -> JWT, nộp câu trả lời
//! GET  /api/surveys/:id/analytics  -> JWT, phân tích dữ liệu
//! GET  /api/surveys/:id/export     -> JWT, xuất dữ liệu (csv/json)
//! ```
//!
//! Mirrors `backend/src/modules/survey/survey.controller.ts` +
//! `survey.service.ts`. `questions_json`/`answers_json` – jsonb (chuỗi UTF-8).

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_SURVEYS: &str = r#"
    SELECT id, title, status, CAST(created_at AS TEXT) AS created_at
    FROM surveys WHERE status = 'active'
    ORDER BY created_at DESC
"#;

const DB_SELECT_SURVEY_BY_ID: &str = r#"
    SELECT id, title, questions_json, status,
           CAST(created_at AS TEXT) AS created_at
    FROM surveys WHERE id::text = $1
"#;

const DB_INSERT_SURVEY: &str = r#"
    INSERT INTO surveys (title, questions_json, created_by, status)
    VALUES ($1,$2,$3::uuid,'active')
    RETURNING id, title, questions_json, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_INSERT_RESPONSE: &str = r#"
    INSERT INTO survey_responses (survey_id, user_id, answers_json)
    VALUES ($1::uuid,$2::uuid,$3)
    RETURNING id::text AS id, survey_id, user_id,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_COUNT_RESPONSES: &str = r#"
    SELECT COUNT(*) FROM survey_responses WHERE survey_id::text = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn survey_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "title": crate::db::opt_text(&row, "title").unwrap_or_default(),
        "questions_json": crate::db::opt_text(&row, "questions_json")
            .and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "status": crate::db::opt_text(&row, "status").unwrap_or_else(|| "active".to_string()),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
    })
}

fn response_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "survey_id": crate::db::text(&row, "survey_id"),
        "answers_json": crate::db::opt_text(&row, "answers_json")
            .and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "created_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct CreateSurveyForm {
    pub title: Option<String>,
    pub questions_json: Option<Value>,
}

#[derive(Debug, Default, Deserialize)]
pub struct SubmitResponseForm {
    pub answers: Option<Value>,
}

#[derive(Debug, Default, Deserialize)]
pub struct FormatQuery {
    pub format: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/surveys` — danh sách các cuộc khảo sát đang hoạt động (public).
pub async fn get_surveys(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = crate::db::query(DB_SELECT_SURVEYS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let surveys: Vec<Value> = rows.iter().map(survey_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::Value::Array(surveys))))
}

/// `GET /api/surveys/:id` — chi tiết một cuộc khảo sát (public).
pub async fn get_survey_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_SELECT_SURVEY_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc khảo sát này.".to_string())),
    };

    Ok(Json(ApiResponse::ok(survey_to_json(&row))))
}

/// `POST /api/surveys` — tạo cuộc khảo sát mới (JWT).
pub async fn create_survey(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<CreateSurveyForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let title = match body.title.as_deref() {
        Some(v) if !v.trim().is_empty() => v,
        _ => return Err(AppError::BadRequest("Tiêu đề khảo sát không được rỗng.".to_string())),
    };

    let questions_json = match body.questions_json.as_ref() {
        Some(v) => serde_json::to_string(v).unwrap_or_default(),
        None => String::new(),
    };

    let row = crate::db::query(DB_INSERT_SURVEY)
        .bind(title)
        .bind(questions_json)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(survey_to_json(&row))))
}

/// `POST /api/surveys/:id/submit` — nộp câu trả lời khảo sát (JWT).
pub async fn submit_response(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Json(body): Json<SubmitResponseForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;

    let row = crate::db::query(DB_SELECT_SURVEY_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc khảo sát này.".to_string())),
    };
    if crate::db::text(&row, "status") != "active" {
        return Err(AppError::BadRequest("Khảo sát này đã đóng.".to_string()));
    }

    let existing: Option<i64> = crate::db::query(
        "SELECT 1 FROM survey_responses WHERE survey_id::text = $1 AND user_id::text = $2",
    )
    .bind(&id)
    .bind(&user.id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?
    .map(|row| row.get::<i64, usize>(0));

    if existing.is_some() {
        return Err(AppError::Conflict("Bạn đã hoàn thành bài khảo sát này rồi.".to_string()));
    }

    let answers = body.answers.unwrap_or(Value::Null);
    let answers_json = serde_json::to_string(&answers).unwrap_or_default();

    let inserted_id: String = crate::db::query(DB_INSERT_RESPONSE)
        .bind(&id)
        .bind(&user.id)
        .bind(answers_json)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String, &str>("id");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": inserted_id,
        "message": "Cảm ơn bạn đã đóng góp ý kiến!",
    }))))
}

/// `GET /api/surveys/:id/analytics` — phân tích dữ liệu khảo sát (JWT).
pub async fn get_survey_analytics(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;

    let row = crate::db::query(DB_SELECT_SURVEY_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc khảo sát này.".to_string())),
    };

    // Cỏi các câu trả lời để xây dựng `questions_stats`.
    let rows = crate::db::query("SELECT answers_json, CAST(created_at AS TEXT) AS created_at FROM survey_responses WHERE survey_id::text = $1")
        .bind(&id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let responses: Vec<Value> = rows.iter().map(response_to_json).collect();

    let total_responses: i64 = crate::db::query(DB_COUNT_RESPONSES)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64, _>(0);

    // Build a simplified analytics payload: the old service counted per question
    // and averages for `rating`/`choice` types — computed in memory here.
    let mut questions_stats: Vec<Value> = Vec::new();
    let questions: Option<Value> = crate::db::opt_text(&row, "questions_json").and_then(|s| serde_json::from_str::<Value>(&s).ok());
    if let Some(questions) = questions {
        if let Some(items) = questions.as_array() {
            for (_idx, q) in items.iter().enumerate() {
                let q_id = q.get("id").and_then(|v| Some(v.to_string()));
                let q_text = q.get("text").and_then(|v| Some(v.to_string()));
                let _ = q_id.as_deref();
                let q_type = q.get("type").and_then(Value::as_str).unwrap_or("text");

                // Filter answers for this question.
                let answers: Vec<Value> = responses.iter().filter_map(|r| {
                    let ans = r.get("answers_json").and_then(|v| Some(v.as_object()?));
                    if let Some(key) = q_id.as_ref() {
                        ans.and_then(|m| m.get(key).cloned())
                    } else {
                        None
                    }
                }).collect();

                let answer_count = answers.len();
                questions_stats.push(serde_json::json!({
                    "question": q_text.unwrap_or_default(),
                    "question_type": q_type,
                    "response_count": answer_count,
                    "answers": answers,
                }));
            }
        }
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "survey_title": crate::db::opt_text(&row, "title").unwrap_or_default(),
        "total_responses": total_responses,
        "questions_stats": questions_stats,
    }))))
}

/// `GET /api/surveys/:id/export?format=csv|json` — xuất dữ liệu câu trả lời
/// khảo sát (JWT).
pub async fn export_survey_data(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(id): Path<String>,
    Query(q): Query<FormatQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;

    let row = crate::db::query(DB_SELECT_SURVEY_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let _row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Không tìm thấy cuộc khảo sát này.".to_string())),
    };

    let rows = crate::db::query("SELECT survey_id, user_id, answers_json, CAST(created_at AS TEXT) AS created_at FROM survey_responses WHERE survey_id::text = $1")
        .bind(&id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    if rows.is_empty() {
        return Err(AppError::BadRequest("Không có dữ liệu để xuất.".to_string()));
    }

    let format = q.format.as_deref().unwrap_or("csv");
    let data = rows.iter().map(|row| {
        let ans: Option<Value> = crate::db::opt_text(&row, "answers_json").and_then(|s| serde_json::from_str::<Value>(&s).ok());
        serde_json::json!({
            "user_id": crate::db::text(&row, "user_id"),
            "submitted_at": crate::db::opt_text(&row, "created_at").unwrap_or_default(),
            "answers": ans.unwrap_or_default(),
        })
    }).collect::<Vec<Value>>();

    let filename = format!("survey-{}-{}", id, chrono::Utc::now().timestamp_millis());
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "filename": filename,
        "format": format,
        "content": data,
    }))))
}
