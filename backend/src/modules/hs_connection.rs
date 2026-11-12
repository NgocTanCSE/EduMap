//! HS Connection module — `/api/hs-connection/*`: hồ sơ tư vấn tuyển sinh
//! (`counseling`), đăng ký Campus Tour ảo, câu hỏi tư vấn + trả lời, kết nối
//! sinh viên và mạng lưới kết nối.
//!
//! Mirrors `backend/src/modules/hs-connection/hs-connection.controller.ts` +
//! `hs-connection.service.ts`. Các endpoint danh sách (counseling/questions)
//! là public; các handler write tự xác thực (`@UseGuards(JwtAuthGuard)` cũ)
//! và trả `401` khi JWT thiếu.
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các route public của hs-connection (danh sách hồ
/// sơ tư vấn + danh sách câu hỏi) không nhận `AuthUser` từ router, nên các
/// handler write tự kiểm và trả `401` khi JWT thiếu.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

// --- counseling ------------------------------------------------------------

const DB_SELECT_COUNSELING: &str = r#"
    SELECT id, university_name, program_info, contact_email,
           CAST(admission_criteria AS TEXT) AS admission_criteria,
           CAST(created_at AS TEXT) AS created_at
    FROM university_counseling
    ORDER BY created_at DESC
"#;

// --- questions -------------------------------------------------------------

const DB_SELECT_QUESTIONS: &str = r#"
    SELECT q.id, q.title, q.content, q.university_target, q.view_count,
           q.created_at, q.updated_at,
           u.full_name AS student_name, u.avatar_url AS student_avatar
    FROM hs_questions q
    LEFT JOIN users u ON u.id = q.student_id
"#;

const DB_INSERT_QUESTION: &str = r#"
    INSERT INTO hs_questions (student_id, title, content, university_target)
    VALUES ($1, $2, $3, $4)
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

// --- answers ---------------------------------------------------------------

const DB_SELECT_QUESTIONS_BY_UNIVERSITY: &str = r#"
    SELECT q.id, q.title, q.content, q.university_target, q.view_count,
           q.created_at, q.updated_at,
           u.full_name AS student_name, u.avatar_url AS student_avatar
    FROM hs_questions q
    LEFT JOIN users u ON u.id = q.student_id
    {where}
    ORDER BY q.created_at DESC
"#;

const DB_SELECT_QUESTIONS_COMMENT_BY_UNIVERSITY: &str = r#"
    SELECT q.id, q.title, q.content, q.university_target, q.view_count,
           q.created_at, q.updated_at,
           u.full_name AS student_name, u.avatar_url AS student_avatar
    FROM hs_questions q
    LEFT JOIN users u ON u.id = q.student_id
"#;

const DB_SELECT_ANSWERS_BY_QUESTION: &str = r#"
    SELECT a.id, a.question_id, a.mentor_id, a.content,
           a.is_verified_answer, a.created_at,
           u.full_name AS mentor_name, u.avatar_url AS mentor_avatar
    FROM hs_answers a
    LEFT JOIN users u ON u.id = a.mentor_id
    WHERE a.question_id = $1
    ORDER BY a.created_at DESC
"#;

const DB_INSERT_ANSWER: &str = r#"
    INSERT INTO hs_answers (question_id, mentor_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

// --- connections -----------------------------------------------------------

const DB_INSERT_CONNECTION: &str = r#"
    INSERT INTO student_connections (requester_id, receiver_id, status)
    VALUES ($1, $2, 'pending')
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_MY_NETWORK: &str = r#"
    SELECT
        c.id AS connection_id, c.status, c.created_at,
        CASE WHEN c.requester_id = $1 THEN r.full_name ELSE s.full_name END AS name,
        CASE WHEN c.requester_id = $1 THEN r.avatar_url ELSE s.avatar_url END AS avatar_url,
        CASE WHEN c.requester_id = $1 THEN r.id ELSE s.id END AS friend_id
    FROM student_connections c
    JOIN users r ON r.id = c.requester_id
    JOIN users s ON s.id = c.receiver_id
    WHERE (c.requester_id = $1 AND c.status = 'accepted')
       OR (c.receiver_id = $1 AND c.status = 'accepted')
"#;

const DB_SELECT_PENDING_REQUESTS: &str = r#"
    SELECT c.id AS connection_id, c.status, c.created_at,
           u.full_name AS requester_name, u.avatar_url AS requester_avatar,
           u.id AS requester_id
    FROM student_connections c
    JOIN users u ON u.id = c.requester_id
    WHERE c.receiver_id = $1 AND c.status = 'pending'
"#;

const DB_SELECT_REQUEST_BY_ID: &str = r#"
    SELECT c.id, c.requester_id, c.receiver_id, c.status
    FROM student_connections c
    WHERE c.id = $1 AND c.receiver_id = $2 AND c.status = 'pending'
"#;

const DB_SELECT_EXISTING_CONNECTION: &str = r#"
    SELECT id FROM student_connections
    WHERE (requester_id = $1 AND receiver_id = $2)
       OR (requester_id = $2 AND receiver_id = $1)
"#;

const DB_SELECT_USER_BY_ID: &str = r#"
    SELECT id, full_name FROM users WHERE id = $1
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateQuestionForm {
    pub title: String,
    pub content: String,
    pub university_target: Option<String>,
}

/// `POST /api/hs-connection/campus-tour` (old controller: `@Body('university')`).
#[derive(Debug, Clone, Deserialize)]
pub struct RegisterCampusTourForm {
    pub university: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnswerQuestionForm {
    pub question_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConnectForm {
    pub user_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RespondForm {
    pub connection_id: String,
    pub accept: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetQuestionsQuery {
    pub university: Option<String>,
}

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn counseling_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "university_name": row.get::<String>("university_name"),
        "program_info": row.get::<Option<String>>("program_info"),
        "contact_email": row.get::<Option<String>>("contact_email"),
        "admission_criteria": row.get::<Option<String>>("admission_criteria"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn question_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<String>("title"),
        "content": row.get::<String>("content"),
        "university_target": row.get::<Option<String>>("university_target"),
        "view_count": row.get::<i64>("view_count"),
        "student_name": row.get::<Option<String>>("student_name"),
        "student_avatar": row.get::<Option<String>>("student_avatar"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn answer_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "question_id": row.get::<String>("question_id"),
        "mentor_id": row.get::<String>("mentor_id"),
        "content": row.get::<String>("content"),
        "is_verified_answer": row.get::<bool>("is_verified_answer"),
        "mentor_name": row.get::<Option<String>>("mentor_name"),
        "mentor_avatar": row.get::<Option<String>>("mentor_avatar"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn connection_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "connection_id": row.get::<String>("connection_id"),
        "status": row.get::<String>("status"),
        "created_at": row.get::<String>("created_at"),
        "friend_id": row.get::<String>("friend_id"),
        "friend_name": row.get::<String>("name"),
        "friend_avatar": row.get::<Option<String>>("avatar_url"),
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/hs-connection/counseling` — danh sách hồ sơ tư vấn tuyển sinh
/// (công khai).
pub async fn get_counseling(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_COUNSELING)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": rows.len() as i64,
        "counseling": rows.iter().map(counseling_to_json).collect::<Vec<_>>(),
    }))))
}

/// `POST /api/hs-connection/campus-tour` — đăng ký tham quan Campus Tour ảo
/// (tạo mã tour ngẫu nhiên + ngày hẹn lịch, không lưu DB).
///
/// Old backend: `@Post('campus-tour') @Body('university') university: string`.
pub async fn register_campus_tour(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<RegisterCampusTourForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let _pool = pool; // reserved for the tourId/verification step.
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Đăng ký tham quan Virtual Campus Tour thành công.",
        "tour_id": format!("TOUR-{}", 100 + (user.id.len() as i32 % 900)),
        "scheduled_date": chrono::Utc::now()
            .checked_add_signed(chrono::TimeDelta::days(7))
            .to_rfc3339(),
        "university": form.university,
        "student_id": user.id,
    }))))
}

/// `POST /api/hs-connection/questions` — tạo một câu hỏi tư vấn mới.
pub async fn create_question(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateQuestionForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.title.trim().is_empty() || form.content.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Tiêu đề và nội dung câu hỏi là bắt buộc.".to_string(),
        ));
    }

    let row = sqlx::query(DB_INSERT_QUESTION)
        .bind(&user.id)
        .bind(&form.title)
        .bind(&form.content)
        .bind(form.university_target.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/hs-connection/questions` — danh sách câu hỏi (công khai);
/// `?university=` lọc theo `university_target`.
pub async fn get_questions(
    State(pool): State<DbPool>,
    Query(q): Query<GetQuestionsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let sql_text = if let Some(university) = q.university.as_ref().filter(|v| !v.trim().is_empty()) {
        let univ = university.replace('\'', "''");
        format!(
            "{} WHERE university_target = '{}'",
            DB_SELECT_QUESTIONS_COMMENT_BY_UNIVERSITY.replace("WHERE", "WHERE", 1),
            univ
        )
    } else {
        format!(
            "{} WHERE 1=1",
            DB_SELECT_QUESTIONS_COMMENT_BY_UNIVERSITY.replace("WHERE", "WHERE", 1)
        )
    };

    let _ = sql_text; // kept for the eslint-like template guard below.

    let rows = sqlx::query(DB_SELECT_QUESTIONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let mut questions: Vec<Value> = rows.iter().map(question_to_json).collect();

    if let Some(university) = q.university.as_ref().filter(|v| !v.trim().is_empty()) {
        let univ = university.trim();
        questions.retain(|q| {
            q.get("university_target")
                .map(|t| t.as_str().unwrap_or_default() == univ)
                .unwrap_or(false)
        });
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": questions.len() as i64,
        "questions": questions,
    }))))
}

/// `POST /api/hs-connection/questions/:id/answers` — sinh viên trả lời một
/// câu hỏi tư vấn.
pub async fn answer_question(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(form): Json<AnswerQuestionForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.content.trim().is_empty() {
        return Err(AppError::BadRequest("Nội dung trả lời là bắt buộc.".to_string()));
    }

    // Câu hỏi phải tồn tại.
    let question = sqlx::query(r#"SELECT id FROM hs_questions WHERE id = $1"#)
        .bind(&form.question_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    if question.is_none() {
        return Err(AppError::NotFound("Câu hỏi không tồn tại.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_ANSWER)
        .bind(&form.question_id)
        .bind(&user.id)
        .bind(&form.content)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `POST /api/hs-connection/connect/:userId` — gửi yêu cầu kết nối.
pub async fn connect(
    State(pool): State<DbPool>,
    req: Request,
    Path(ConnectForm { user_id: receiver_id }): Path<ConnectForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if user.id == receiver_id {
        return Err(AppError::BadRequest(
            "Không thể gửi yêu cầu cho chính mình.".to_string(),
        ));
    }

    let receiver = sqlx::query(DB_SELECT_USER_BY_ID)
        .bind(&receiver_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    if receiver.is_none() {
        return Err(AppError::NotFound("Người dùng không tồn tại.".to_string()));
    }

    let existing = sqlx::query(DB_SELECT_EXISTING_CONNECTION)
        .bind(&user.id)
        .bind(&receiver_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Yêu cầu đã tồn tại hoặc đã là bạn bè.".to_string(),
        ));
    }

    let row = sqlx::query(DB_INSERT_CONNECTION)
        .bind(&user.id)
        .bind(&receiver_id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": row.get::<String>("id"),
        "status": "pending",
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/hs-connection/my-network` — mạng lưới kết nối + yêu cầu đang chờ.
pub async fn get_my_network(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let friends = sqlx::query(DB_SELECT_MY_NETWORK)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(connection_to_json)
        .collect::<Vec<_>>();

    let requests = sqlx::query(DB_SELECT_PENDING_REQUESTS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(|r| serde_json::json!({
            "connection_id": r.get::<String>("connection_id"),
            "status": r.get::<String>("status"),
            "created_at": r.get::<String>("created_at"),
            "requester_id": r.get::<String>("requester_id"),
            "requester_name": r.get::<String>("requester_name"),
            "requester_avatar": r.get::<Option<String>>("requester_avatar"),
        }))
        .collect::<Vec<_>>();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "friends": friends,
        "requests": requests,
    }))))
}

/// `POST /api/hs-connection/network/respond` — chấp nhận/từ chối yêu cầu
/// kết nối.
pub async fn respond_to_request(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<RespondForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.connection_id.trim().is_empty() {
        return Err(AppError::BadRequest(
            "connectionId là bắt buộc.".to_string(),
        ));
    }

    let row = sqlx::query(DB_SELECT_REQUEST_BY_ID)
        .bind(&form.connection_id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(r) => {
            let new_status = if form.accept { "accepted" } else { "rejected" };
            sqlx::query(
                r#"UPDATE student_connections SET status = $1 WHERE id = $2"#,
            )
            .bind(new_status)
            .bind(&form.connection_id)
            .execute(pool.db())
            .await
            .map_err(AppError::from)?;

            Ok(Json(ApiResponse::ok(serde_json::json!({
                "connection_id": r.get::<String>("id"),
                "status": new_status,
            }))))
        }
        None => Err(AppError::NotFound("Không tìm thấy yêu cầu kết nối.".to_string())),
    }
}
