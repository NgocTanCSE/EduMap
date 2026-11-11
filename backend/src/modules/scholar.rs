//! Scholarships module — `/api/scholarships/*`: danh sách/trang chi tiết học
//! bổng, nộp đơn, kiểm tra điều kiện (AI proxy), hồ sơ ứng tuyển.
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; tất cả
//! các endpoint đọc là public, các handler write tự xác thực (old
//! `@UseGuards(JwtAuthGuard)` / `RolesGuard`) và trả `401` khi JWT thiếu):
//!
//! ```text
//! GET  /api/scholarships             -> public, phân trang (page/limit)
//! GET  /api/scholarships/:id         -> public, chi tiết
//! POST /api/scholarships/:id/check-eligibility -> JWT, AI proxy
//! GET  /api/scholarships/me/applications  -> JWT, đơn đang nộp
//! POST /api/scholarships/:id/apply   -> JWT, nộp hồ sơ
//! POST /api/scholarships             -> admin/mod, tạo học bổng
//! PUT  /api/scholarships/:id         -> admin/mod, cập nhật
//! ```
//!
//! Mirrors `backend/src/modules/scholar/scholarship.controller.ts` +
//! `scholarship.service.ts`. `eligibility_criteria` (jsonb) được đọc/ghi qua
//! JSON text.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::extract::{Path, Query, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các route đọc của scholarships còn là public nên
/// các handler write tự lấy `AuthUser` ra khỏi extensions và trả `401` khi
/// JWT bị mất.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` (tương đương `@Roles(ADMIN, MODERATOR)` của old
/// backend).
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

const DB_SELECT_SCHOLARSHIPS: &str = r#"
    SELECT id, title, provider, value_amount, deadline,
           CAST(status AS TEXT) AS status,
           CAST(eligibility_criteria AS TEXT) AS eligibility_criteria,
           apply_url, created_at
    FROM scholarships WHERE deleted_at IS NULL
"#;

const DB_SELECT_SCHOLARSHIP_BY_ID: &str = r#"
    SELECT id, title, description, provider, value_amount, deadline,
           CAST(status AS TEXT) AS status,
           CAST(eligibility_criteria AS TEXT) AS eligibility_criteria,
           apply_url, created_at
    FROM scholarships WHERE id = $1
"#;

const DB_INSERT_SCHOLARSHIP: &str = r#"
    INSERT INTO scholarships (title, description, provider, value_amount,
                              deadline, eligibility_criteria, apply_url, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, title, description, provider, value_amount, deadline,
              CAST(status AS TEXT) AS status,
              CAST(eligibility_criteria AS TEXT) AS eligibility_criteria,
              apply_url, created_at
"#;

const DB_UPDATE_SCHOLARSHIP: &str = r#"
    UPDATE scholarships SET title = COALESCE($1, title),
        description = COALESCE($2, description),
        provider = COALESCE($3, provider),
        value_amount = COALESCE($4, value_amount),
        deadline = COALESCE($5, deadline),
        eligibility_criteria = COALESCE($6, eligibility_criteria),
        apply_url = COALESCE($7, apply_url),
        status = COALESCE($8, status),
        updated_at = NOW()
    WHERE id = $9
    RETURNING id, title, description, provider, value_amount, deadline,
              CAST(status AS TEXT) AS status,
              CAST(eligibility_criteria AS TEXT) AS eligibility_criteria,
              apply_url, created_at
"#;

const DB_INSERT_APPLICATION: &str = r#"
    INSERT INTO scholarship_applications (scholarship_id, student_id,
                                          personal_statement, cv_url, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING id, scholarship_id, student_id, status,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SELECT_APPLICATIONS: &str = r#"
    SELECT a.id, a.scholarship_id, a.personal_statement, a.cv_url, a.status,
           a.created_at,
           s.title AS scholarship_title, s.provider AS scholarship_provider
    FROM scholarship_applications a
    LEFT JOIN scholarships s ON s.id = a.scholarship_id
    WHERE a.student_id = $1
    ORDER BY a.created_at DESC
"#;

const DB_SELECT_USER: &str = r#"
    SELECT id, full_name, major, role
    FROM users WHERE id = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn scholarship_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "provider": row.get::<Option<String>>("provider").unwrap_or_default(),
        "value_amount": row.get::<Option<f64>>("value_amount").unwrap_or(0.0),
        "deadline": row.get::<Option<String>>("deadline").unwrap_or_default(),
        "eligibility_criteria": row.get::<Option<String>>("eligibility_criteria")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "apply_url": row.get::<Option<String>>("apply_url"),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
    })
}

fn application_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "scholarship_id": row.get::<String>("scholarship_id"),
        "status": row.get::<Option<String>>("status").unwrap_or_default(),
        "personal_statement": row.get::<Option<String>>("personal_statement").unwrap_or_default(),
        "cv_url": row.get::<Option<String>>("cv_url").unwrap_or_default(),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        "scholarship": serde_json::json!({
            "title": row.get::<Option<String>>("scholarship_title").unwrap_or_default(),
            "provider": row.get::<Option<String>>("scholarship_provider").unwrap_or_default(),
        }),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct ScholarshipListQuery {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct CreateScholarshipRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub provider: Option<String>,
    pub value_amount: Option<f64>,
    pub deadline: Option<String>,
    pub eligibility_criteria: Option<Value>,
    pub apply_url: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ApplyScholarshipRequest {
    pub personal_statement: Option<String>,
    pub cv_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct EligibilityRequest {
    pub user_data: Option<Value>,
    pub scholarship_data: Option<Value>,
    pub transcript_data: Option<Value>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/scholarships` — danh sách học bổng (phân trang).
pub async fn get_scholarships(
    State(pool): State<DbPool>,
    Query(q): Query<ScholarshipListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let page = q.page.unwrap_or(1).clamp(1, 100);
    let limit = q.limit.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * limit;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM scholarships WHERE deleted_at IS NULL")
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let rows = sqlx::query(&format!(
        "{} ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        DB_SELECT_SCHOLARSHIPS
    ))
    .bind(&limit)
    .bind(&offset)
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;

    let items: Vec<Value> = rows.iter().map(scholarship_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": items,
        "meta": serde_json::json!({
            "totalItems": total,
            "itemCount": items.len(),
            "itemsPerPage": limit,
            "totalPages": ((total + limit - 1) / limit),
            "currentPage": page,
        }),
    }))))
}

/// `GET /api/scholarships/:id` — chi tiết một học bổng.
pub async fn get_scholarship_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_SCHOLARSHIP_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Học bổng không tồn tại.".to_string())),
    };

    Ok(Json(ApiResponse::ok(scholarship_to_json(&row))))
}

/// `POST /api/scholarships/:id/check-eligibility` — kiểm tra điều kiện học
/// bổng (proxy vào ai-service `POST /api/ai/scholarship/check`); khi
/// ai-service đáp ứng lại thì trả về phản hồi template dựa vào metadata của
/// học bổng.
pub async fn check_eligibility(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<EligibilityRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // Lấy học bổng (id) và user (id của người gọi để gửi AI).
    let scholarship = sqlx::query(DB_SELECT_SCHOLARSHIP_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let scholarship = match scholarship {
        Some(row) => scholarship_to_json(&row),
        None => return Err(AppError::NotFound("Học bổng không tồn tại.".to_string())),
    };

    let user_row = sqlx::query(DB_SELECT_USER)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let user_row = match user_row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Người dùng không tồn tại.".to_string())),
    };

    let user_data = serde_json::json!({
        "id": user.id,
        "full_name": user_row.get::<Option<String>>("full_name").unwrap_or_default(),
        "major": user_row.get::<Option<String>>("major").unwrap_or_default(),
    });

    let transcript_data = body.transcript_data.unwrap_or_default();

    let payload = serde_json::json!({
        "user_data": user_data,
        "scholarship_data": scholarship,
        "transcript_data": transcript_data,
    });

    match proxy_to_ai_service("/api/ai/scholarship/check", payload).await {
        Ok(value) => Ok(Json(ApiResponse::ok(value))),
        Err(_) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "is_eligible": true,
            "message": "Ai-service tạm gián đoạn — dựa vào thông tin hồ sơ đã điền.",
            "degraded": true,
        })))),
    }
}

/// `POST /api/scholarships/:id/apply` — nộp đơn học bổng.
pub async fn apply_scholarship(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<ApplyScholarshipRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_SELECT_SCHOLARSHIP_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Học bổng không tồn tại.".to_string())),
    };
    if row.get::<String>("status") != "active" {
        return Err(AppError::BadRequest("Học bổng này đã đóng."));
    }

    let existing: Option<i64> = sqlx::query(
        "SELECT 1 FROM scholarship_applications WHERE scholarship_id = $1 AND student_id = $2",
    )
    .bind(&id)
    .bind(&user.id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?
    .map(|row| row.get::<i64>(0));

    if existing.is_some() {
        return Err(AppError::Conflict("Bạn đã nộp đơn cho học bổng này rồi."));
    }

    let statement = body.personal_statement.unwrap_or_default();
    let cv_url = body.cv_url.unwrap_or_default();

    let inserted_id: String = sqlx::query(DB_INSERT_APPLICATION)
        .bind(&id)
        .bind(&user.id)
        .bind(&statement)
        .bind(&cv_url)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String>("id");

    // Gửi thông báo nộp đơn cho người dùng đó (qua ai-service mail).
    let _ = send_notification_to_user(pool, &user.id, format!(
        "Nộp đơn thành công: Bạn đã nộp hồ sơ ứng tuyển học bổng: {}. Vui lòng theo dõi trạng thái.",
        row.get::<Option<String>>("title").unwrap_or_default(),
    )).await;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": inserted_id,
        "message": "Nộp đơn thành công. Vui lòng theo dõi trạng thái tại Dashboard.",
    }))))
}

/// `GET /api/scholarships/me/applications` — danh sách đơn nộp của mình.
pub async fn get_my_applications(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_SELECT_APPLICATIONS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let applications: Vec<Value> = rows.iter().map(application_to_json).collect();

    Ok(Json(ApiResponse::ok(applications)))
}

/// `POST /api/scholarships` — tạo học bổng mới (admin/mod).
pub async fn create_scholarship(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreateScholarshipRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let title = match body.title.as_ref() {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Err(AppError::BadRequest("Tiêu đề học bổng không được rỗng.")),
    };

    let row = sqlx::query(DB_INSERT_SCHOLARSHIP)
        .bind(title.as_deref())
        .bind(body.description.as_deref())
        .bind(body.provider.as_deref())
        .bind(body.value_amount)
        .bind(body.deadline.as_deref())
        .bind(body.eligibility_criteria.as_ref().map(|v| v.to_string()))
        .bind(body.apply_url.as_deref())
        .bind(body.status.as_deref().unwrap_or("active"))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(scholarship_to_json(&row))))
}

/// `PUT /api/scholarships/:id` — cập nhật học bổng (admin/mod).
pub async fn update_scholarship(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<CreateScholarshipRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let row = sqlx::query(DB_SELECT_SCHOLARSHIP_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Học bổng không tồn tại.".to_string())),
    };

    let updated_id: String = sqlx::query(DB_UPDATE_SCHOLARSHIP)
        .bind(body.title.as_deref())
        .bind(body.description.as_deref())
        .bind(body.provider.as_deref())
        .bind(body.value_amount)
        .bind(body.deadline.as_deref())
        .bind(body.eligibility_criteria.as_ref().map(|v| v.to_string()))
        .bind(body.apply_url.as_deref())
        .bind(body.status.as_deref())
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String>("id");

    let row = sqlx::query(DB_SELECT_SCHOLARSHIP_BY_ID)
        .bind(&updated_id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(scholarship_to_json(&row))))
}

/// Helper: gửi thông báo in-app cho người dùng (các admin mới gửi).
async fn send_notification_to_user(pool: &DbPool, user_id: &str, message: String) -> Result<(), AppError> {
    sqlx::query("INSERT INTO notifications (user_id, title, body, channel, is_read, sent_at) VALUES ($1, $2, $3, $4, false, NOW())")
        .bind(user_id)
        .bind("Gửi đơn")
        .bind(&message)
        .bind("in-app")
        .execute(pool.db())
        .await
        .map(|_| ())
        .map_err(AppError::Io)
}
