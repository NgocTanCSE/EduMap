//! Career module — `/api/career/*`: jobs (list/search/create/update/delete),
//! career paths, skill roadmaps, user careers, user skills, applications,
//! resume upload, AI career advice (`predictCareerPath` +
//! `recommendCareerSemantic`).
//!
//! Mirrors `backend/src/modules/career/career.controller.ts` +
//! `career.service.ts`. `/api/career/jobs{,/:id}`, `/api/career/paths{,/:id}`
//! and `/api/career/roadmap/:id` are public (the old backend had no
//! `@UseGuards` on them); every other route needs a JWT
//! (`@UseGuards(JwtAuthGuard)` in the old backend).
//!
//! All SQL uses the runtime API (`query!` requires a live DB at compile time).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::error;

/// The upload directory for `/api/career/upload-resume`: CVs are stored on the
/// Docker volume and served (static) at `/api/storage/media/<objectName>`.
/// The file uses `original_name` + a timestamp prefix so names never collide.
fn uploads_dir() -> PathBuf {
    PathBuf::from("/tmp/edumap-uploads")
}

/// The logged-in user: the public career endpoints (`jobs`, `paths`,
/// `roadmap`) don't get an `AuthUser` from the router (`PUBLIC_PATHS`), so the
/// write handlers self-check and answer `401` when the JWT was missing.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// Career paths are admin/moderator only (`@Roles(ADMIN, MODERATOR)`).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "mod") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_JOBS: &str = r#"
    SELECT id, title, description, company_name, location, job_type, salary_range,
           CAST(required_skills AS TEXT) AS required_skills,
           experience_level, CAST(application_deadline AS TEXT) AS application_deadline,
           views, status, posted_by_user_id, career_path_id,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM jobs
    WHERE status = 'active'
"#;

const DB_SELECT_JOB_BY_ID: &str = r#"
    SELECT id, title, description, company_name, location, job_type, salary_range,
           CAST(required_skills AS TEXT) AS required_skills,
           experience_level, CAST(application_deadline AS TEXT) AS application_deadline,
           views, status, posted_by_user_id, career_path_id,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at,
           u.full_name AS posted_by_name
    FROM jobs j
    LEFT JOIN users u ON u.id = j.posted_by_user_id
    WHERE id = $1
"#;

const DB_SELECT_PATHS: &str = r#"
    SELECT CAST(id AS TEXT) AS id, title, field, description, CAST(roadmap_json AS TEXT) AS roadmap_json,
           CAST(skills_required AS TEXT) AS skills_required, salary_range, demand_level,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM career_paths
"#;

const DB_SELECT_PATH_BY_ID: &str = r#"
    SELECT id, title, field, description, CAST(roadmap_json AS TEXT) AS roadmap_json,
           CAST(skills_required AS TEXT) AS skills_required, salary_range, demand_level,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM career_paths
    WHERE id = $1
"#;

const DB_SELECT_USER_CAREER: &str = r#"
    SELECT id, user_id, career_path_id, goal_title, description,
           CAST(target_date AS TEXT) AS target_date, status,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM user_careers WHERE user_id = $1 ORDER BY created_at DESC
"#;

const DB_SELECT_USER_SKILL: &str = r#"
    SELECT id, user_id, skill_name, proficiency_level, description,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
    FROM user_skills WHERE user_id = $1 ORDER BY skill_name ASC
"#;

const DB_SELECT_APPLICATIONS: &str = r#"
    SELECT id, user_id, job_id, cover_letter, resume_url, status,
           CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at,
           job.title AS job_title, job.company_name AS job_company_name,
           job.location AS job_location, CAST(job.application_deadline AS TEXT)
           AS job_deadline
    FROM applications a
    LEFT JOIN jobs job ON job.id = a.job_id
    WHERE a.user_id = $1 ORDER BY a.created_at DESC
"#;

const DB_SELECT_APPLICATION_BY_ID: &str = r#"
    SELECT id, user_id, job_id, cover_letter, resume_url, status,
           CAST(updated_at AS TEXT) AS updated_at,
           CAST(created_at AS TEXT) AS created_at,
           job.title AS job_title, job.location AS job_location
    FROM applications a
    LEFT JOIN jobs job ON job.id = a.job_id
    WHERE id = $1 AND user_id = $2
"#;

const DB_INSERT_JOB: &str = r#"
    INSERT INTO jobs (title, description, company_name, location, job_type,
                      salary_range, required_skills, experience_level,
                      application_deadline, posted_by_user_id, career_path_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_INSERT_CAREER_PATH: &str = r#"
    INSERT INTO career_paths (title, field, description, skills_required,
                              roadmap_json, salary_range, demand_level)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING CAST(id AS TEXT) AS id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_UPDATE_JOB: &str = r#"
    UPDATE jobs SET title = $1, description = $2, company_name = $3, location = $4,
        job_type = COALESCE($5, job_type), salary_range = $6, required_skills = $7,
        experience_level = $8, application_deadline = $9, status = COALESCE($10, status),
        updated_at = NOW()
    WHERE id = $11 AND posted_by_user_id = $12
    RETURNING id, CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_CREATE_USER_CAREER: &str = r#"
    INSERT INTO user_careers (user_id, career_path_id, goal_title, description,
                              target_date, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_UPDATE_USER_CAREER: &str = r#"
    UPDATE user_careers SET career_path_id = COALESCE($1, career_path_id),
        goal_title = $2, description = $3, target_date = COALESCE($4, target_date),
        status = $5, updated_at = NOW()
    WHERE id = $6 AND user_id = $7
    RETURNING id, CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_CREATE_USER_SKILL: &str = r#"
    INSERT INTO user_skills (user_id, skill_name, proficiency_level, description)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, skill_name) DO UPDATE SET
        proficiency_level = EXCLUDED.proficiency_level,
        description = EXCLUDED.description,
        updated_at = NOW()
    RETURNING id, CAST(created_at AS TEXT) AS created_at
"#;

const DB_UPDATE_USER_SKILL: &str = r#"
    UPDATE user_skills SET proficiency_level = COALESCE($1, proficiency_level),
        description = $2, updated_at = NOW()
    WHERE id = $3 AND user_id = $4
    RETURNING id, CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_INSERT_APPLICATION: &str = r#"
    INSERT INTO applications (user_id, job_id, cover_letter, resume_url, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT)
           AS updated_at
"#;

const DB_UPDATE_APPLICATION_STATUS: &str = r#"
    UPDATE applications SET status = $1, updated_at = NOW()
    WHERE id = $2 AND user_id = $3
    RETURNING id, CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_INSERT_USER_FILE: &str = r#"
    INSERT INTO user_files (user_id, original_name, file_url, mime_type, size_kb)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, original_name, file_url, mime_type, size_kb,
              CAST(created_at AS TEXT) AS created_at
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SearchJobsQuery {
    pub keyword: Option<String>,
    pub location: Option<String>,
    pub job_type: Option<String>,
    pub experience_level: Option<String>,
    pub salary_range: Option<String>,
    pub career_path_id: Option<String>,
    pub field: Option<String>,
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateJobForm {
    pub title: String,
    pub description: String,
    pub company_name: Option<String>,
    pub location: Option<String>,
    pub job_type: Option<String>,
    pub salary_range: Option<String>,
    pub required_skills: Option<String>,
    pub experience_level: Option<String>,
    pub application_deadline: Option<String>,
    pub career_path_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateJobForm {
    pub title: Option<String>,
    pub description: Option<String>,
    pub company_name: Option<String>,
    pub location: Option<String>,
    pub job_type: Option<String>,
    pub salary_range: Option<String>,
    pub required_skills: Option<String>,
    pub experience_level: Option<String>,
    pub application_deadline: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateCareerPathForm {
    pub title: String,
    pub field: Option<String>,
    pub description: Option<String>,
    pub skills_required: Option<String>,
    pub roadmap_json: Option<String>,
    pub salary_range: Option<String>,
    pub demand_level: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateUserCareerForm {
    pub career_path_id: Option<String>,
    pub goal_title: String,
    pub description: Option<String>,
    pub target_date: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateUserCareerForm {
    pub career_path_id: Option<String>,
    pub goal_title: Option<String>,
    pub description: Option<String>,
    pub target_date: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateUserSkillForm {
    pub skill_name: String,
    pub proficiency_level: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateUserSkillForm {
    pub proficiency_level: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApplyJobForm {
    pub job_id: String,
    pub cover_letter: Option<String>,
    pub resume_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateApplicationStatusForm {
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Roadmap {
    pub career_id: i64,
    pub career_title: String,
    pub field: Option<String>,
    pub description: Option<String>,
    pub skills_required: Option<serde_json::Value>,
    pub roadmap: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// A `jobs` row as a single `serde_json::Value` (the **detail** query also
/// selects `u.full_name AS posted_by_name`, so it reads that field).
fn job_to_json(row: &sqlx::PgRow) -> serde_json::Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<String>("title"),
        "description": row.get::<String>("description"),
        "company_name": row.get::<Option<String>>("company_name"),
        "location": row.get::<Option<String>>("location"),
        "job_type": row.get::<String>("job_type"),
        "salary_range": row.get::<Option<String>>("salary_range"),
        "required_skills": row.get::<Option<serde_json::Value>>("required_skills"),
        "experience_level": row.get::<Option<String>>("experience_level"),
        "application_deadline": row.get::<Option<String>>("application_deadline"),
        "views": row.get::<i64>("views"),
        "status": row.get::<String>("status"),
        "posted_by": row.get::<Option<String>>("posted_by_name"),
        "posted_by_user_id": row.get::<Option<String>>("posted_by_user_id"),
        "career_path_id": row.get::<Option<i64>>("career_path_id"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

/// A jobs **list** row (same column set *without* `posted_by_name`, like the
/// old `searchJobs` that didn't load the `posted_by` relation).
fn job_list_to_json(row: &sqlx::PgRow) -> serde_json::Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<String>("title"),
        "description": row.get::<String>("description"),
        "company_name": row.get::<Option<String>>("company_name"),
        "location": row.get::<Option<String>>("location"),
        "job_type": row.get::<String>("job_type"),
        "salary_range": row.get::<Option<String>>("salary_range"),
        "required_skills": row.get::<Option<serde_json::Value>>("required_skills"),
        "experience_level": row.get::<Option<String>>("experience_level"),
        "application_deadline": row.get::<Option<String>>("application_deadline"),
        "views": row.get::<i64>("views"),
        "status": row.get::<String>("status"),
        "career_path_id": row.get::<Option<i64>>("career_path_id"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

/// Parse an optional `YYYY-MM-DD` / ISO-8601 string into a `Timestamp with time
/// zone` chrono `DateTime<Utc>` for binding into Postgres `TIMESTAMP WITH TIME
/// ZONE` columns. The front-end sends dates as plain strings (the old backend
/// used TypeORM's implicit text→timestamptz cast), so this helper normalises the
/// formats: `2025-12-01`, `2025-12-01T00:00:00Z`.
fn to_naive_datetime(s: &Option<String>) -> Option<chrono::DateTime<chrono::Utc>> {
    match s {
        Some(v) if !v.trim().is_empty() => {
            let v = v.trim();
            // Full ISO-8601 (`2025-12-01T10:00:00Z`) → `DateTime<Utc>` straight.
            chrono::DateTime::parse_from_rfc3339(v)
                .ok()
                .map(|t| t.with_timezone(&chrono::Utc))
                // Date-only strings (`2025-12-01`) → midnight.
                .or_else(|| {
                    NaiveDate::parse_from_str(v, "%Y-%m-%d")
                        .ok()
                        .and_then(|d| d.and_hms_opt(0, 0, 0).ok())
                        .map(|t| t.and_utc())
                })
                // Naive datetimes (`YYYY-MM-DDTHH:MM:SS`, `YYYY-MM-DD HH:MM:SS`).
                .or_else(|| {
                    NaiveDateTime::parse_from_str(v, "%Y-%m-%dT%H:%M:%S%.f%:z")
                        .ok()
                        .map(|t| t.and_utc())
                })
                .or_else(|| {
                    NaiveDateTime::parse_from_str(v, "%Y-%m-%dT%H:%M:%S")
                        .ok()
                        .map(|t| t.and_utc())
                })
                .or_else(|| {
                    NaiveDateTime::parse_from_str(v, "%Y-%m-%d %H:%M:%S")
                        .ok()
                        .map(|t| t.and_utc())
                })
                .unwrap_or_default()
        }
        _ => None,
    }
}

/// The old backend's `suggestCareer` answer when the AI service is unreachable
/// (`degraded: true`).
fn template_suggestions() -> serde_json::Value {
    serde_json::json!([
        {
            "career_id": null,
            "title": "AI Engineer / Machine Learning Engineer",
            "field": "Công nghệ thông tin",
            "match_score": 85,
            "explanation": "Ngành công nghệ thông tin và AI đang là xu hướng phát triển mạnh.",
            "missing_skills": ["Python", "Machine Learning", "Statistics"],
            "demand_level": "Cao",
        },
        {
            "career_id": null,
            "title": "Fullstack Developer",
            "field": "Công nghệ thông tin",
            "match_score": 78,
            "explanation": "Lĩnh vực phát triển web fullstack luôn có nhu cầu ổn định.",
            "missing_skills": ["TypeScript", "React", "Node.js"],
            "demand_level": "Cao",
        },
        {
            "career_id": null,
            "title": "Data Scientist",
            "field": "Công nghệ thông tin",
            "match_score": 72,
            "explanation": "Phân tích dữ liệu và khai phá thông tin ngành đang tăng trưởng.",
            "missing_skills": ["Python", "Pandas", "Statistics"],
            "demand_level": "Trung bình",
        },
    ])
}

// ---------------------------------------------------------------------------
// Job list + search
// ---------------------------------------------------------------------------

/// `GET /api/career/jobs` — public job search (mirrors `searchJobs` in the old
/// backend: keyword/location/job_type/experience_level/salary_range/
/// career_path_id + pagination).
pub async fn get_jobs(
    State(pool): State<DbPool>,
    Query(q): Query<SearchJobsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let limit: i64 = q
        .limit
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10)
        .clamp(1, 100);
    let page: i64 = q
        .page
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1)
        .max(1);
    let offset = (page - 1) * limit;

    // The old backend used `query-builder` `andWhere` on every filter (all
    // joined with AND). The SQL mask below reads the same filters as text
    // literals — so the binds are two numbers (`limit`/`offset`) and nothing
    // else.
    let mut filters: Vec<String> = Vec::new();

    if let Some(keyword) = q.keyword.as_ref().filter(|v| !v.trim().is_empty()) {
        let kw = format!("%{}%", keyword.trim().to_lowercase());
        filters.push(format!(
            "(LOWER(title) LIKE LOWER('{}'))",
            kw.replace('\'', "''")
        ));
    }

    if let Some(location) = q.location.as_ref().filter(|v| !v.trim().is_empty()) {
        let loc = format!("%{}%", location.trim().to_lowercase());
        filters.push(format!(
            "LOWER(location) LIKE LOWER('{}')",
            loc.replace('\'', "''")
        ));
    }

    if let Some(job_type) = q.job_type.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "job_type = '{}'",
            job_type.trim().replace('\'', "''")
        ));
    }

    if let Some(experience_level) =
        q.experience_level.as_ref().filter(|v| !v.trim().is_empty())
    {
        let lvl = format!("%{}%", experience_level.trim().to_lowercase());
        filters.push(format!(
            "LOWER(experience_level) LIKE LOWER('{}')",
            lvl.replace('\'', "''")
        ));
    }

    if let Some(salary_range) = q.salary_range.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "salary_range = '{}'",
            salary_range.trim().replace('\'', "''")
        ));
    }

    if let Some(career_path_id) = q.career_path_id.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "career_path_id = {}",
            career_path_id.trim()
        ));
    }

    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!(" AND ({})", filters.join(" AND "))
    };

    // `COUNT(*)` in the same conditions (no binds).
    let count_sql = format!(
        "SELECT COUNT(*) FROM jobs WHERE status = 'active'{}",
        where_clause
    );
    let total: i64 = sqlx::query(&count_sql)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>(0);

    // The job list (page + order by `created_at` DESC).
    let list_sql = format!("{}{}", DB_SELECT_JOBS, where_clause);
    let list_sql = format!("{} LIMIT $1 OFFSET $2", list_sql);
    let rows = sqlx::query(&list_sql)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let jobs: Vec<serde_json::Value> = rows.iter().map(job_list_to_json).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": total,
        "jobs": jobs,
        "page": page,
        "limit": limit,
    }))))
}

// ---------------------------------------------------------------------------
// Job detail + CRUD
// ---------------------------------------------------------------------------

/// `GET /api/career/jobs/:id` — public (mirrors `getJobById`, which bumps
/// `views`).
pub async fn get_job_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_JOB_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let job = match row {
        Some(row) => job_to_json(&row),
        None => return Ok(Json(ApiResponse::ok(serde_json::json!(null)))),
    };
    sqlx::query(
        r#"UPDATE jobs SET views = views + 1 WHERE id = $1 RETURNING id"#
    )
    .bind(&id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(job)))
}

/// `POST /api/career/jobs` — sign a new job listing (JWT guarded).
pub async fn create_job(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateJobForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let skills = from_json_array(&form.required_skills);
    let career_path_id = form
        .career_path_id
        .as_ref()
        .and_then(|v| v.parse::<i64>().ok());
    let job_type = form.job_type.clone().unwrap_or_else(|| "full_time".to_string());
    let deadline = to_naive_datetime(&form.application_deadline);
    let inserted = sqlx::query(DB_INSERT_JOB)
        .bind(&form.title)
        .bind(&form.description)
        .bind(&form.company_name)
        .bind(&form.location)
        .bind(&job_type)
        .bind(&form.salary_range)
        .bind(&skills)
        .bind(&form.experience_level)
        .bind(&deadline)
        .bind(&user.id)
        .bind(&career_path_id)
        .bind(&"active".to_string())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": inserted.get::<String>("id"),
        "created_at": inserted.get::<String>("created_at"),
    }))))
}

/// `PATCH /api/career/jobs/:id` — the employer updates their own listing.
pub async fn update_job(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateJobForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let skills = from_json_array(&form.required_skills);
    let deadline = to_naive_datetime(&form.application_deadline);
    let updated = sqlx::query(DB_UPDATE_JOB)
        .bind(&form.title)
        .bind(&form.description)
        .bind(&form.company_name)
        .bind(&form.location)
        .bind(&form.job_type)
        .bind(&form.salary_range)
        .bind(&skills)
        .bind(&form.experience_level)
        .bind(&deadline)
        .bind(&form.status)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match updated {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "updated_at": row.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound(
            "Job không tìm thấy hoặc bạn không có quyền chỉnh sửa.".to_string(),
        )),
    }
}

/// `DELETE /api/career/jobs/:id` — the employer removes their own listing.
pub async fn delete_job(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let deleted = sqlx::query(
        r#"DELETE FROM jobs WHERE id = $1 AND posted_by_user_id = $2"#
    )
    .bind(&id)
    .bind(&user.id)
    .execute(pool.db())
    .await
    .map_err(AppError::from)?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Job không tìm thấy hoặc bạn không có quyền xóa.".to_string(),
        ));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Job đã được xóa thành công.",
    }))))
}

// ---------------------------------------------------------------------------
// Career paths + roadmap
// ---------------------------------------------------------------------------

/// `GET /api/career/paths` — public career path list (`field` filter).
pub async fn get_paths(
    State(pool): State<DbPool>,
    Query(q): Query<SearchJobsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    // Optional `field` filter (the old `getPaths` used `where: { field }`).
    let use_field = q.field.as_ref().filter(|v| !v.trim().is_empty());
    let sql = match use_field {
        Some(field) => format!("{} WHERE field = $1 ORDER BY created_at DESC", DB_SELECT_PATHS),
        None => format!("{} ORDER BY created_at DESC", DB_SELECT_PATHS),
    };
    let rows = match use_field {
        Some(field) => sqlx::query(&sql)
            .bind(field)
            .fetch_all(pool.db())
            .await
            .map_err(AppError::from)?,
        None => sqlx::query(&sql)
            .fetch_all(pool.db())
            .await
            .map_err(AppError::from)?,
    };
    let rows = rows
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "title": row.get::<String>("title"),
            "field": row.get::<Option<String>>("field"),
            "description": row.get::<Option<String>>("description"),
            "skills_required": row.get::<Option<serde_json::Value>>("skills_required"),
            "roadmap_json": row.get::<Option<serde_json::Value>>("roadmap_json"),
            "salary_range": row.get::<Option<String>>("salary_range"),
            "demand_level": row.get::<Option<String>>("demand_level"),
            "created_at": row.get::<String>("created_at"),
            "updated_at": row.get::<String>("updated_at"),
        }))
        .collect::<Vec<serde_json::Value>>();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": rows.len(),
        "items": rows,
    }))))
}

/// `GET /api/career/paths/:id` — public (mirrors `getPathById`).
pub async fn get_path_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let path_id = id
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("id phải là số".to_string()))?;
    let row = sqlx::query(DB_SELECT_PATH_BY_ID)
        .bind(&path_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let path = match row {
        Some(row) => serde_json::json!({
            "id": row.get::<String>("id"),
            "title": row.get::<String>("title"),
            "field": row.get::<Option<String>>("field"),
            "description": row.get::<Option<String>>("description"),
            "skills_required": row.get::<Option<serde_json::Value>>("skills_required"),
            "roadmap_json": row.get::<Option<serde_json::Value>>("roadmap_json"),
            "salary_range": row.get::<Option<String>>("salary_range"),
            "demand_level": row.get::<Option<String>>("demand_level"),
            "created_at": row.get::<String>("created_at"),
            "updated_at": row.get::<String>("updated_at"),
        }),
        None => return Ok(Json(ApiResponse::ok(serde_json::json!(null)))),
    };
    Ok(Json(ApiResponse::ok(path)))
}

/// `GET /api/career/roadmap/:id` — public skill roadmap for a career path
/// (mirrors `getSkillRoadmap`).
pub async fn get_skill_roadmap(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let path_id = id
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("id phải là số".to_string()))?;
    let row = sqlx::query(DB_SELECT_PATH_BY_ID)
        .bind(&path_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let road = match row {
        Some(row) => Roadmap {
            career_id: row.get::<i64>("id"),
            career_title: row.get::<String>("title"),
            field: row.get::<Option<String>>("field"),
            description: row.get::<Option<String>>("description"),
            skills_required: row.get::<Option<serde_json::Value>>("skills_required"),
            roadmap: row.get::<Option<serde_json::Value>>("roadmap_json"),
        },
        None => return Ok(Json(ApiResponse::ok(serde_json::json!(null)))),
    };
    // `roadmap_json` is optional (nullable) — fall back to the old template.
    let roadmap = road
        .roadmap
        .clone()
        .unwrap_or_else(|| serde_json::json!([
            {"phase": "Beginner", "skills": ["HTML", "CSS", "Basic Logic"]},
            {"phase": "Intermediate", "skills": ["TypeScript", "Node.js", "Database"]},
            {"phase": "Advanced", "skills": ["System Architecture", "CI/CD"]},
        ]));
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "career_id": road.career_id,
        "career_title": road.career_title,
        "field": road.field,
        "description": road.description,
        "skills_required": road.skills_required,
        "roadmap": roadmap,
    }))))
}

/// `POST /api/career/paths` — create a career path (admin/mod only).
pub async fn create_path(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateCareerPathForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;
    let skills = from_json_array(&form.skills_required);
    let roadmap = from_json_array(&form.roadmap_json);
    let created = sqlx::query(DB_INSERT_CAREER_PATH)
        .bind(&form.title)
        .bind(&form.field)
        .bind(&form.description)
        .bind(&skills)
        .bind(&roadmap)
        .bind(&form.salary_range)
        .bind(&form.demand_level)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": created.get::<String>("id"),
        "created_at": created.get::<String>("created_at"),
    }))))
}

// ---------------------------------------------------------------------------
// User careers
// ---------------------------------------------------------------------------

/// `GET /api/career/user-careers` — own goal list (JWT guarded).
pub async fn get_user_careers(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_SELECT_USER_CAREER)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "user_id": row.get::<String>("user_id"),
            "career_path_id": row.get::<Option<i64>>("career_path_id"),
            "goal_title": row.get::<String>("goal_title"),
            "description": row.get::<Option<String>>("description"),
            "target_date": row.get::<Option<String>>("target_date"),
            "status": row.get::<String>("status"),
            "created_at": row.get::<String>("created_at"),
            "updated_at": row.get::<String>("updated_at"),
        }))
        .collect::<Vec<serde_json::Value>>();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": rows.len(),
        "items": rows,
    }))))
}

/// `POST /api/career/user-careers` — add a career goal (JWT guarded).
pub async fn create_user_career(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateUserCareerForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let career_path_id = form
        .career_path_id
        .as_ref()
        .and_then(|v| v.parse::<i64>().ok());
    let status = form
        .status
        .clone()
        .unwrap_or_else(|| "active".to_string());
    let target_date = form.target_date.as_ref().map(|v| v.to_string());
    let created = sqlx::query(DB_CREATE_USER_CAREER)
        .bind(&user.id)
        .bind(&career_path_id)
        .bind(&form.goal_title)
        .bind(&form.description)
        .bind(&target_date)
        .bind(&status)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": created.get::<String>("id"),
        "created_at": created.get::<String>("created_at"),
    }))))
}

/// `PATCH /api/career/user-careers/:id` — own goal update.
pub async fn update_user_career(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateUserCareerForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let career_path_id = form
        .career_path_id
        .clone()
        .and_then(|v| v.parse::<i64>().ok());
    let target_date = form.target_date.as_ref().map(|v| v.to_string());
    let status = form
        .status
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "active".to_string());
    let updated = sqlx::query(DB_UPDATE_USER_CAREER)
        .bind(&career_path_id)
        .bind(&form.goal_title)
        .bind(&form.description)
        .bind(&target_date)
        .bind(&status)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match updated {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "updated_at": row.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound(
            "Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền chỉnh sửa.".to_string(),
        )),
    }
}

/// `DELETE /api/career/user-careers/:id` — own goal deletion.
pub async fn delete_user_career(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let deleted = sqlx::query(
        r#"DELETE FROM user_careers WHERE id = $1 AND user_id = $2"#
    )
    .bind(&id)
    .bind(&user.id)
    .execute(pool.db())
    .await
    .map_err(AppError::from)?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền xóa.".to_string(),
        ));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Nguyện vọng nghề nghiệp đã được xóa thành công.",
    }))))
}

// ---------------------------------------------------------------------------
// User skills
// ---------------------------------------------------------------------------

/// `GET /api/career/user-skills` — own skill list (JWT guarded).
pub async fn get_user_skills(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_SELECT_USER_SKILL)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "user_id": row.get::<String>("user_id"),
            "skill_name": row.get::<String>("skill_name"),
            "proficiency_level": row.get::<String>("proficiency_level"),
            "description": row.get::<Option<String>>("description"),
            "created_at": row.get::<String>("created_at"),
            "updated_at": row.get::<String>("updated_at"),
        }))
        .collect::<Vec<serde_json::Value>>();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": rows.len(),
        "items": rows,
    }))))
}

/// `POST /api/career/user-skills` — add/update an own skill (JWT guarded).
pub async fn create_user_skill(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateUserSkillForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let proficiency = form
        .proficiency_level
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "beginner".to_string());
    let created = sqlx::query(DB_CREATE_USER_SKILL)
        .bind(&user.id)
        .bind(&form.skill_name)
        .bind(&proficiency)
        .bind(&form.description)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": created.get::<String>("id"),
        "created_at": created.get::<String>("created_at"),
    }))))
}

/// `PATCH /api/career/user-skills/:id` — own skill update.
pub async fn update_user_skill(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateUserSkillForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let proficiency = form
        .proficiency_level
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "beginner".to_string());
    let updated = sqlx::query(DB_UPDATE_USER_SKILL)
        .bind(&proficiency)
        .bind(&form.description)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match updated {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "updated_at": row.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound(
            "Kỹ năng không tìm thấy hoặc bạn không có quyền chỉnh sửa.".to_string(),
        )),
    }
}

/// `DELETE /api/career/user-skills/:id` — own skill deletion.
pub async fn delete_user_skill(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let deleted = sqlx::query(
        r#"DELETE FROM user_skills WHERE id = $1 AND user_id = $2"#
    )
    .bind(&id)
    .bind(&user.id)
    .execute(pool.db())
    .await
    .map_err(AppError::from)?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Kỹ năng không tìm thấy hoặc bạn không có quyền xóa.".to_string(),
        ));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Kỹ năng đã được xóa thành công.",
    }))))
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/// `GET /api/career/applications` — own application history (JWT guarded).
pub async fn get_user_applications(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_SELECT_APPLICATIONS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
        .iter()
        .map(|row| serde_json::json!({
            "id": row.get::<String>("id"),
            "user_id": row.get::<String>("user_id"),
            "job_id": row.get::<String>("job_id"),
            "job_title": row.get::<Option<String>>("job_title"),
            "job_company_name": row.get::<Option<String>>("job_company_name"),
            "job_location": row.get::<Option<String>>("job_location"),
            "job_deadline": row.get::<Option<String>>("job_deadline"),
            "cover_letter": row.get::<Option<String>>("cover_letter"),
            "resume_url": row.get::<Option<String>>("resume_url"),
            "status": row.get::<String>("status"),
            "created_at": row.get::<String>("created_at"),
            "updated_at": row.get::<String>("updated_at"),
        }))
        .collect::<Vec<serde_json::Value>>();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": rows.len(),
        "items": rows,
    }))))
}

/// `GET /api/career/applications/:id` — own application detail (JWT guarded).
pub async fn get_application_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let row = sqlx::query(DB_SELECT_APPLICATION_BY_ID)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let app = match row {
        Some(row) => serde_json::json!({
            "id": row.get::<String>("id"),
            "user_id": row.get::<String>("user_id"),
            "job_id": row.get::<String>("job_id"),
            "job_title": row.get::<Option<String>>("job_title"),
            "job_location": row.get::<Option<String>>("job_location"),
            "cover_letter": row.get::<Option<String>>("cover_letter"),
            "resume_url": row.get::<Option<String>>("resume_url"),
            "status": row.get::<String>("status"),
            "updated_at": row.get::<String>("updated_at"),
            "created_at": row.get::<String>("created_at"),
        }),
        None => return Ok(Json(ApiResponse::ok(serde_json::json!(null)))),
    };
    Ok(Json(ApiResponse::ok(app)))
}

/// `POST /api/career/applications` — apply to a job (JWT guarded).
pub async fn apply_to_job(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<ApplyJobForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let existing = sqlx::query(
        r#"SELECT id FROM applications WHERE user_id = $1 AND job_id = $2"#
    )
    .bind(&user.id)
    .bind(&form.job_id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    if existing.is_some() {
        return Err(AppError::Conflict("Bạn đã ứng tuyển vào Job này rồi.".to_string()));
    }
    let job = sqlx::query(
        r#"SELECT id FROM jobs WHERE id = $1 AND status = 'active'"#
    )
    .bind(&form.job_id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    if job.is_none() {
        return Err(AppError::NotFound("Job không tìm thấy.".to_string()));
    }
    let created = sqlx::query(DB_INSERT_APPLICATION)
        .bind(&user.id)
        .bind(&form.job_id)
        .bind(&form.cover_letter)
        .bind(&form.resume_url)
        .bind(&"pending".to_string())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": created.get::<String>("id"),
        "created_at": created.get::<String>("created_at"),
        "updated_at": created.get::<String>("updated_at"),
    }))))
}

/// `PATCH /api/career/applications/:id/status` — the employer/admin updates the
/// application status (JWT guarded).
pub async fn update_application_status(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateApplicationStatusForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let application = sqlx::query(
        r#"SELECT a.id, a.status, a.user_id, job.posted_by_user_id
           FROM applications a LEFT JOIN jobs job ON job.id = a.job_id
           WHERE a.id = $1"#
    )
    .bind(&id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    let application = match application {
        Some(row) => row,
        None => return Err(AppError::NotFound(
            "Ứng tuyển không tìm thấy.".to_string(),
        )),
    };
    let posted_by = application.get::<Option<String>>("posted_by_user_id");
    let is_owner = posted_by.as_ref().map(|v| v == &user.id).unwrap_or(false);
    if user.role != "admin" && !is_owner {
        return Err(AppError::NotFound(
            "Bạn không có quyền cập nhật trạng thái ứng tuyển này.".to_string(),
        ));
    }
    let updated = sqlx::query(DB_UPDATE_APPLICATION_STATUS)
        .bind(&form.status)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match updated {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "updated_at": row.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound("Ứng tuyển không tìm thấy.".to_string())),
    }
}

/// `PATCH /api/career/applications/:id/withdraw` — withdraw an application
/// (JWT guarded).
pub async fn withdraw_application(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let application = sqlx::query(
        r#"SELECT id, status FROM applications WHERE id = $1 AND user_id = $2"#
    )
    .bind(&id)
    .bind(&user.id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    let application = match application {
        Some(row) => row,
        None => return Err(AppError::NotFound(
            "Ứng tuyển không tìm thấy hoặc bạn không có quyền rút.".to_string(),
        )),
    };
    let status = application.get::<String>("status");
    if status == "accepted" || status == "rejected" {
        return Err(AppError::Conflict(
            "Không thể rút ứng tuyển đã được chấp nhận hoặc từ chối.".to_string(),
        ));
    }
    let updated = sqlx::query(DB_UPDATE_APPLICATION_STATUS)
        .bind(&"withdrawn".to_string())
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match updated {
        Some(row) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": row.get::<String>("id"),
            "updated_at": row.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound("Ứng tuyển không tìm thấy.".to_string())),
    }
}

// ---------------------------------------------------------------------------
// Resume upload (multipart)
// ---------------------------------------------------------------------------

/// `POST /api/career/upload-resume` — upload a CV (JWT guarded; mirrors
/// `uploadResume` → `storageService.uploadFile`).
pub async fn upload_resume(
    State(pool): State<DbPool>,
    req: Request,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // Read the file from the multipart stream.
    let mut data: Vec<u8> = Vec::new();
    let mut original_name = String::from("resume");
    let mut mime_type = String::from("application/octet-stream");
    while let Some(field) = multipart.next_field().await.map_err(AppError::from)? {
        if let Some(name) = field.file_name() {
            original_name = name.to_string();
        }
        if let Some(mime) = field.mime_type() {
            mime_type = mime.to_string();
        }
        let mut chunk = Vec::new();
        while let Some(bytes) = field.chunk().await.map_err(AppError::from)? {
            chunk.extend_from_slice(&bytes);
        }
        data = chunk;
        break;
    }

    if data.is_empty() {
        return Err(AppError::BadRequest(
            "Chưa có tập tin nào được tải lên.".to_string(),
        ));
    }

    let mut dir = uploads_dir();
    fs::create_dir_all(&dir).map_err(AppError::from)?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis();
    let safe_name = original_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();
    let object_name = format!("{}-{}", timestamp, safe_name);
    let file_url = format!("/api/storage/media/{}", object_name);
    let filepath = dir.join(&object_name);
    fs::write(&filepath, &data).map_err(AppError::from)?;
    let size_kb = (data.len() as f64 / 1024.0).round() as f64;

    let created = sqlx::query(DB_INSERT_USER_FILE)
        .bind(&user.id)
        .bind(&original_name)
        .bind(&file_url)
        .bind(&mime_type)
        .bind(&size_kb)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": created.get::<String>("id"),
        "original_name": created.get::<String>("original_name"),
        "file_url": created.get::<String>("file_url"),
        "mime_type": created.get::<String>("mime_type"),
        "size_kb": created.get::<f64>("size_kb"),
        "created_at": created.get::<String>("created_at"),
    }))))
}

// ---------------------------------------------------------------------------
// AI career advice (proxied into the ai-service)
// ---------------------------------------------------------------------------

/// `GET /api/career/ai-advice` — deep AI career advice from the AI service.
pub async fn get_ai_advice(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // The old backend fetched the user + skills + careers before asking the AI;
    // the AI service handles a user id — the payload is the minimum the endpoint
    // expects.
    let user_row = sqlx::query(
        r#"SELECT id, full_name, email, avatar_url, role, mbti_type FROM users WHERE id = $1"#
    )
    .bind(&user.id)
    .fetch_optional(pool.db())
    .await
    .map_err(AppError::from)?;
    let user_row = match user_row {
        Some(row) => row,
        None => return Err(AppError::NotFound(
            "Không tìm thấy thông tin người dùng.".to_string(),
        )),
    };
    let skills = sqlx::query(DB_SELECT_USER_SKILL)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let careers = sqlx::query(DB_SELECT_USER_CAREER)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let ai_input = serde_json::json!({
        "user_id": user.id,
        "full_name": user_row.get::<String>("full_name"),
        "skills": skills
            .iter()
            .map(|row| format!(
                "{} ({})",
                row.get::<String>("skill_name"),
                row.get::<String>("proficiency_level")
            ))
            .collect::<Vec<String>>(),
        "mbti_type": user_row.get::<Option<String>>("mbti_type").unwrap_or_else(|| {
            "Chưa xác định".to_string()
        }),
        "career_aspirations": careers
            .iter()
            .map(|row| row.get::<String>("goal_title"))
            .collect::<Vec<String>>(),
        "recent_keywords": "Phát triển sự nghiệp bền vững",
    });

    let result = proxy_to_ai_service("/api/ai/career/recommend", ai_input).await;
    match result {
        Ok(data) => Ok(Json(ApiResponse::ok(data))),
        Err(e) => {
            error!("ai career advice proxy failed: {}", e);
            Err(AppError::Internal(
                "Dịch vụ tư vấn nghề nghiệp AI hiện chưa khả dụng.".to_string(),
            ))
        }
    }
}

/// `POST /api/career/suggest` — career suggestions computed by the AI service
/// (`recommendCareerSemantic`) with a template fallback.
pub async fn suggest_career(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // The AI follows the same data: skills + career goals (interests).
    let skills = sqlx::query(DB_SELECT_USER_SKILL)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let skill_names: Vec<String> = skills
        .iter()
        .map(|row| row.get::<String>("skill_name").to_lowercase())
        .collect();

    let careers = sqlx::query(DB_SELECT_USER_CAREER)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let interests: Vec<String> = careers
        .iter()
        .filter_map(|row| {
            row.get::<Option<String>>("goal_title")
                .filter(|v| !v.is_empty())
                .or_else(|| {
                    row.get::<Option<String>>("career_path_id")
                        .map(|career| career.replace("-", "").replace("(", "").replace(")", ""))
                })
                .filter(|v| !v.is_empty())
        })
        .collect();

    let body = serde_json::json!({
        "skills": skill_names,
        "interests": interests,
        "experience_level": "beginner",
        "user_id": user.id,
    });
    let ai_result = proxy_to_ai_service("/api/ai/career/recommend-semantic", body).await;

    if let Ok(data) = ai_result {
        if let Some(top_careers) = data.get("top_careers").and_then(|v| v.as_array()) {
            if !top_careers.is_empty() {
                let suggestions = top_careers
                    .iter()
                    .map(|c| serde_json::json!({
                        "career_id": c.get("career_id").map(|v| v.to_string()),
                        "title": c.get("title").map(|v| v.to_string()),
                        "field": c.get("field").map(|v| v.to_string()),
                        "match_score": c.get("match_score").map(|v| v.to_string()),
                        "explanation": c.get("explanation").map(|v| v.to_string()),
                        "missing_skills": c.get("missing_skills").map(|v| v.to_string()),
                        "demand_level": c.get("demand_level").map(|v| v.to_string()),
                        "radar_chart": c.get("radar_chart").map(|v| v.to_string()),
                    }))
                    .collect::<Vec<serde_json::Value>>();
                return Ok(Json(ApiResponse::ok(serde_json::json!({
                    "input_analysis": {
                        "skills": skill_names,
                        "interests": interests,
                    },
                    "top_suggestions": suggestions,
                    "degraded": data.get("degraded").unwrap_or(&false).is_boolean(),
                    "source": data
                        .get("source")
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "semantic".to_string()),
                }))));
            }
        }
    }

    // Template fallback (the old backend's `degraded: true` default).
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "input_analysis": {
            "skills": skill_names,
            "interests": interests,
        },
        "top_suggestions": template_suggestions(),
        "degraded": true,
        "source": "template-fallback",
    }))))
}

/// Parse a raw JSON string into `serde_json::Value` (the old backend
/// `required_skills`/`skills_required` columns are `jsonb`).
fn from_json_array(s: &Option<String>) -> serde_json::Value {
    match s {
        Some(v) => {
            match serde_json::from_str::<serde_json::Value>(v) {
                Ok(mut arr) => {
                    if !arr.is_array() {
                        arr = serde_json::Value::Null;
                    }
                    arr
                }
                Err(_) => serde_json::Value::Null,
            }
        }
        None => serde_json::Value::Null,
    }
}
