//! Mentoring module — `/api/mentoring/*`: mentor registration, mentor search,
//! AI mentor recommendations, availability slots, booking and booking status.
//!
//! Mirrors `backend/src/modules/mentor/mentor.controller.ts` +
//! `mentor.service.ts`. Every route is public at the `AuthLayer` level so the
//! mentor pages keep working for guests; the write handlers authenticate
//! themselves and answer `401`/`403` when the token is missing or the actor is
//! not allowed to touch the record.
//!
//! All SQL uses the runtime API (`query!` requires a live DB at compile time).
//! `mentors.user_id` is the primary key (there is no `id` column), so every
//! mentor query binds/fetches `user_id`.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use tracing::warn;

/// The demo user the old backend fell back to when a student profile was
/// missing (mirrors `backend/src/common/constants/dev-user.constants.ts`).
const DEV_USER_UUID: &str = "f379e1c3-81a0-46d0-905a-2472667ad129";
/// How many pre-filtered mentors are sent to the ai-service (the LLM prompt
/// size cap in `ai-service/services/llm_service.py::match_mentors`).
const MAX_MENTORS_TO_LLM: usize = 15;
/// The meeting URL prefix for a new booking (the old backend sliced the first
/// 8 characters of the mentor UUID).
const MEET_JITSI_PREFIX: &str = "https://meet.jit.si/edumap-mentor-";

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterMentorForm {
    pub bio: Option<String>,
    pub specialties: Option<String>,
    pub experience_years: Option<String>,
    pub hourly_rate: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AvailabilityForm {
    pub day_of_week: i64,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BookMentorForm {
    pub mentor_id: String,
    pub slot: BookingSlot,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BookingSlot {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SlotsQuery {
    pub date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBookingStatusForm {
    pub status: String,
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_USER: &str = r#"
    SELECT id, full_name, email, avatar_url, major, mbti_type, location,
           CAST(skills AS TEXT) AS skills,
           CAST(interests AS TEXT) AS interests
    FROM users WHERE id = $1
"#;

const DB_MENTOR_BASE: &str = r#"
    SELECT m.user_id, m.bio, m.specialties, m.location, m.experience_years,
           CAST(m.rating_avg AS TEXT) AS rating_avg,
           CAST(m.hourly_rate AS TEXT) AS hourly_rate, m.is_verified,
           CAST(m.created_at AS TEXT) AS created_at,
           CAST(m.updated_at AS TEXT) AS updated_at,
           u.full_name, u.email, u.avatar_url, u.major, u.mbti_type,
           CAST(u.skills AS TEXT) AS skills,
           CAST(u.interests AS TEXT) AS interests, u.role
    FROM mentors m LEFT JOIN users u ON u.id = m.user_id
"#;

const DB_MENTOR_BY_ID: &str = r#"
    SELECT m.user_id, m.bio, m.specialties, m.location, m.experience_years,
           CAST(m.rating_avg AS TEXT) AS rating_avg,
           CAST(m.hourly_rate AS TEXT) AS hourly_rate, m.is_verified,
           CAST(m.created_at AS TEXT) AS created_at,
           CAST(m.updated_at AS TEXT) AS updated_at,
           u.full_name, u.email, u.avatar_url, u.major, u.mbti_type,
           CAST(u.skills AS TEXT) AS skills,
           CAST(u.interests AS TEXT) AS interests, u.role
    FROM mentors m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.user_id = $1
"#;

const DB_MENTORS: &str = r#"
    SELECT m.user_id, m.bio, m.specialties, m.location, m.experience_years,
           CAST(m.rating_avg AS TEXT) AS rating_avg,
           CAST(m.hourly_rate AS TEXT) AS hourly_rate, m.is_verified,
           CAST(m.created_at AS TEXT) AS created_at,
           CAST(m.updated_at AS TEXT) AS updated_at,
           u.full_name, u.email, u.avatar_url, u.major, u.mbti_type,
           CAST(u.skills AS TEXT) AS skills,
           CAST(u.interests AS TEXT) AS interests, u.role
    FROM mentors m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.is_verified = true
    ORDER BY m.rating_avg DESC
"#;

const DB_INSERT_MENTOR: &str = r#"
    INSERT INTO mentors (user_id, bio, specialties, experience_years,
                         hourly_rate, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING user_id, bio, specialties, experience_years,
              CAST(rating_avg AS TEXT) AS rating_avg,
              CAST(hourly_rate AS TEXT) AS hourly_rate, is_verified,
              CAST(created_at AS TEXT) AS created_at,
              CAST(updated_at AS TEXT) AS updated_at
"#;

const DB_AVAILABILITIES: &str = r#"
    SELECT id, day_of_week, start_time, end_time, is_active,
           CAST(created_at AS TEXT) AS created_at
    FROM mentor_availabilities
    WHERE mentor_id = $1 AND is_active = true
    ORDER BY day_of_week, start_time
"#;

const DB_INSERT_AVAILABILITY: &str = r#"
    INSERT INTO mentor_availabilities (mentor_id, day_of_week, start_time,
                                       end_time, is_active)
    VALUES ($1, $2, $3, $4, true)
    RETURNING id, day_of_week, start_time, end_time, is_active,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_SLOTS: &str = r#"
    SELECT a.id::TEXT, a.start_time, a.end_time,
           EXISTS (
               SELECT 1 FROM bookings b
               WHERE b.mentor_id = a.mentor_id
                 AND b.status = 'confirmed'
                 AND DATE(b.slot_start) = $2
                 AND TO_CHAR(b.slot_start, 'HH24:MI') = TO_CHAR(a.start_time, 'HH24:MI')
           ) AS is_booked
    FROM mentor_availabilities a
    WHERE a.mentor_id = $1 AND a.day_of_week = $3 AND a.is_active = true
    ORDER BY a.start_time
"#;

const DB_INSERT_BOOKING: &str = r#"
    INSERT INTO bookings (mentor_id, student_id, slot_start, slot_end, status,
                          payment_status, amount, meeting_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, mentor_id, student_id,
              CAST(slot_start AS TEXT) AS slot_start,
              CAST(slot_end AS TEXT) AS slot_end,
              status, payment_status, amount, meeting_url,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_CONFLICT_BOOKING: &str = r#"
    SELECT id FROM bookings
    WHERE mentor_id = $1 AND slot_start = $2 AND status = 'confirmed'
"#;

const DB_BOOKING_BY_ID: &str = r#"
    SELECT b.id, b.mentor_id, b.student_id,
           CAST(b.slot_start AS TEXT) AS slot_start,
           CAST(b.slot_end AS TEXT) AS slot_end,
           b.status, b.payment_status, CAST(b.amount AS TEXT) AS amount, b.meeting_url,
           CAST(b.created_at AS TEXT) AS created_at,
           u.full_name AS mentor_name, s.full_name AS student_name
    FROM bookings b
    LEFT JOIN mentors m ON m.user_id = b.mentor_id
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN users s ON s.id = b.student_id
    WHERE b.id = $1
"#;

const DB_UPDATE_BOOKING_STATUS: &str = r#"
    UPDATE bookings SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, mentor_id, student_id,
              CAST(slot_start AS TEXT) AS slot_start,
              CAST(slot_end AS TEXT) AS slot_end,
              status, payment_status, amount, meeting_url,
              CAST(created_at AS TEXT) AS created_at
"#;

const DB_STUDENT_BOOKINGS: &str = r#"
    SELECT b.id, b.mentor_id, b.student_id,
           CAST(b.slot_start AS TEXT) AS slot_start,
           CAST(b.slot_end AS TEXT) AS slot_end,
           b.status, b.payment_status, CAST(b.amount AS TEXT) AS amount, b.meeting_url,
           CAST(b.created_at AS TEXT) AS created_at,
           u.full_name AS mentor_name
    FROM bookings b
    LEFT JOIN mentors m ON m.user_id = b.mentor_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE b.student_id = $1
    ORDER BY b.slot_start DESC
"#;

const DB_MENTOR_BOOKINGS: &str = r#"
    SELECT b.id, b.mentor_id AS student_id, b.student_id,
           CAST(b.slot_start AS TEXT) AS slot_start,
           CAST(b.slot_end AS TEXT) AS slot_end,
           b.status, b.payment_status, CAST(b.amount AS TEXT) AS amount, b.meeting_url,
           CAST(b.created_at AS TEXT) AS created_at,
           u.full_name AS mentor_name
    FROM bookings b
    LEFT JOIN mentors m ON m.user_id = b.mentor_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE b.mentor_id = $1
    ORDER BY b.slot_start DESC
"#;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/// The logged-in user: the mentoring routes are all public at the middleware
/// level, so the write handlers pull the token out of the extensions
/// themselves and answer `401` when it is missing (the old backend used
/// `@UseGuards(JwtAuthGuard)`).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `ADMIN` / `MODERATOR` / `SUPER_ADMIN` (the old `RolesGuard`).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator" | "super_admin") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

/// Whether the actor may touch this record (`self-or-admin`).
fn ensure_self_or_admin(user: &AuthUser, target: &str, only_self: &str) -> Result<(), AppError> {
    if user.id == target {
        return Ok(());
    }
    // Người dùng bình thường cũng chỉ được xem/chỉnh sửa lịch của chính mình.
    match ensure_admin(user) {
        Ok(()) => Ok(()),
        Err(_) => Err(AppError::Forbidden(only_self.to_string())),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Escape a single quote for a Postgres string literal.
fn esc(s: &str) -> String {
    s.replace('\'', "''")
}

/// Build a JSON string literal for a `jsonb` `@>` filter.
fn json_string_literal(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Parse a `YYYY-MM-DD` (or an ISO date prefix) into a `NaiveDate`.
fn parse_date(s: &str) -> Result<NaiveDate, AppError> {
    let v = s.trim();
    NaiveDate::parse_from_str(v, "%Y-%m-%d")
        .or_else(|| {
            v.split('T')
                .next()
                .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        })
        .ok_or_else(|| AppError::BadRequest("Ngày không hợp lệ (cần dạng YYYY-MM-DD)".to_string()))
}

/// Parse an ISO-8601 timestamp into `DateTime<Utc>` (the frontend sends
/// `slot.start` / `slot.end` from `toISOString()`).
fn parse_timestamp(s: &str) -> Result<chrono::DateTime<Utc>, AppError> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|t| t.with_timezone(&chrono::Utc))
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f%:z")
                .ok()
                .map(|t| t.and_utc())
        })
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
                .ok()
                .map(|t| t.and_utc())
        })
        .ok_or_else(|| AppError::BadRequest("Giờ không hợp lệ".to_string()))
}

/// Parse `specialties` của Mentor: nhận được JSON mảng (`["UI","UX"]`)
/// hoặc danh sách phân tách dấu phẩy.
fn parse_specialties(raw: Option<&str>) -> Vec<String> {
    match raw {
        Some(v) if !v.trim().is_empty() => {
            let v = v.trim();
            if v.starts_with('[') {
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(v) {
                    return arr.into_iter().map(|s| s.trim().to_string()).collect();
                }
            }
            v.split(',').map(|s| s.trim().to_string()).collect()
        }
        _ => Vec::new(),
    }
}

/// Trả lại vec đã cho, hoặc giá trị mặc định khi vec rỗng (Vec không có
/// `if_empty` trong std).
fn if_empty<T: Clone>(vec: &[T], default: Vec<T>) -> Vec<T> {
    if vec.is_empty() {
        default
    } else {
        vec.to_vec()
    }
}

/// Decode a TEXT[] column that Postgres returns as a Postgres-array string
/// (`{a,b}`) or as a JSON string.
fn text_array_to_vec(raw: Option<String>) -> Vec<String> {
    match raw {
        Some(v) if !v.trim().is_empty() => {
            let v = v.trim();
            if v.starts_with('[') {
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(v) {
                    return arr;
                }
            }
            v.trim_matches(|c| c == '{' || c == '}')
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        }
        _ => Vec::new(),
    }
}

/// Turn a joined mentor/user row into the object the frontend expects
/// (`user_id`, mentor fields + a nested `user` block).
fn mentor_to_json(row: &impl sqlx::Row) -> serde_json::Value {
    let user_id = row.get::<String>("user_id");
    let full_name = row.get::<Option<String>>("full_name");
    serde_json::json!({
        "user_id": user_id,
        "bio": row.get::<Option<String>>("bio"),
        "specialties": row.get::<Option<serde_json::Value>>("specialties"),
        "location": row.get::<Option<String>>("location"),
        "experience_years": row.get::<i32>("experience_years"),
        "rating_avg": row.get::<Option<String>>("rating_avg").unwrap_or_else(|| "0".to_string()),
        "hourly_rate": row.get::<Option<String>>("hourly_rate"),
        "is_verified": row.get::<bool>("is_verified"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
        "user": {
            "id": user_id.clone(),
            "full_name": full_name,
            "email": row.get::<Option<String>>("email"),
            "avatar_url": row.get::<Option<String>>("avatar_url"),
            "major": row.get::<Option<String>>("major"),
            "mbti_type": row.get::<Option<String>>("mbti_type"),
            "skills": text_array_to_vec(row.get::<Option<String>>("skills")),
            "interests": text_array_to_vec(row.get::<Option<String>>("interests")),
            "role": row.get::<Option<String>>("role"),
        }
    })
}

/// A bookings row, with the mentor/student names flattened.
fn booking_to_json(row: &impl sqlx::Row) -> serde_json::Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "mentor_id": row.get::<String>("mentor_id"),
        "student_id": row.get::<String>("student_id"),
        "slot_start": row.get::<String>("slot_start"),
        "slot_end": row.get::<String>("slot_end"),
        "status": row.get::<String>("status"),
        "payment_status": row.get::<Option<String>>("payment_status"),
        "amount": row.get::<Option<String>>("amount"),
        "meeting_url": row.get::<Option<String>>("meeting_url"),
        "created_at": row.get::<String>("created_at"),
        "mentor_name": row.get::<Option<String>>("mentor_name"),
        "student_name": row.get::<Option<String>>("student_name"),
    })
}

/// The degraded AI-match reply (never a 502): an empty match list with an
/// honest reason, matching `ai-service/routers/mentor.py::MentorMatchResponse`.
fn degraded_matches(student_id: &str, err: &str) -> serde_json::Value {
    serde_json::json!({
        "student_id": student_id,
        "top_matches": Vec::<serde_json::Value>::new(),
        "degraded": true,
        "reason": format!("Ghép nối mentor không khả dụng: {}", err),
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/mentoring/register/:userId` — đăng ký làm Mentor.
///
/// Self-or-admin: một tài khoản chỉ có thể đăng ký mentor cho chính mình, trừ
/// khi người dùng có vai trò admin/moderator/super_admin.
pub async fn register_mentor(
    State(pool): State<DbPool>,
    Path(user_id): Path<String>,
    req: Request,
    Json(form): Json<RegisterMentorForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let actor = authenticated_user(&req)?;
    if actor.id != user_id {
        ensure_admin(&actor)?;
    }

    let user_row = sqlx::query(DB_SELECT_USER)
        .bind(&user_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match user_row {
        None => return Err(AppError::NotFound("Không tìm thấy tài khoản người dùng".to_string())),
        Some(_) => {}
    }

    let exists = sqlx::query("SELECT user_id FROM mentors WHERE user_id = $1")
        .bind(&user_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    if exists.is_some() {
        return Err(AppError::BadRequest(
            "Tài khoản này đã đăng ký làm Mentor".to_string(),
        ));
    }

    let specialties = parse_specialties(form.specialties.as_deref());
    let experience_years = form
        .experience_years
        .as_deref()
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);
    let hourly_rate = form.hourly_rate.as_deref().and_then(|v| v.parse::<f64>().ok());

    let inserted = sqlx::query(DB_INSERT_MENTOR)
        .bind(&user_id)
        .bind(&form.bio)
        .bind(&serde_json::Value::from(specialties))
        .bind(&experience_years)
        .bind(&hourly_rate)
        .bind(&false)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(mentor_to_json(&inserted))))
}

/// `GET /api/mentoring/mentors` — danh sách Mentor đã duyệt, lọc theo chuyên
/// môn.
pub async fn get_mentors(
    State(pool): State<DbPool>,
    Query(q): Query<MentorsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let specialty = q.specialty.as_ref().filter(|v| !v.trim().is_empty());

    let sql = match specialty {
        Some(s) => {
            let lower = s.to_lowercase();
            let like = format!("LOWER(m.specialties::TEXT) LIKE LOWER('%{}%')", esc(&lower));
            let jsonb = format!("m.specialties @> {}::jsonb", json_string_literal(&lower));
            format!(
                "{} AND ({} OR {}) ORDER BY m.rating_avg DESC",
                DB_MENTOR_BASE,
                like,
                jsonb
            )
        }
        None => DB_MENTORS.to_string(),
    };

    let rows = sqlx::query(&sql)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let mentors: Vec<serde_json::Value> = rows.iter().map(mentor_to_json).collect();
    Ok(Json(ApiResponse::ok(mentors)))
}

/// `GET /api/mentoring/mentors/:id` — chi tiết một Mentor.
pub async fn get_mentor_by_id(
    State(pool): State<DbPool>,
    Path(mentor_id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let row = sqlx::query(DB_MENTOR_BY_ID)
        .bind(&mentor_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(row) => Ok(Json(ApiResponse::ok(mentor_to_json(&row)))),
        None => Err(AppError::NotFound("Mentor không tồn tại".to_string())),
    }
}

/// `GET /api/mentoring/mentors/recommend/:userId` — gợi ý Mentor bằng AI
/// (pre-filter theo chuyên môn/khu vực ≤15 mentor).
pub async fn recommend_mentors(
    State(pool): State<DbPool>,
    Path(user_id): Path<String>,
    Query(q): Query<RecommendQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    // Sinh viên: lấy hồ sơ thật, nếu không có thì dùng tài khoản demo.
    let user_row = sqlx::query(DB_SELECT_USER)
        .bind(&user_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let user_row = if user_row.is_none() {
        sqlx::query(DB_SELECT_USER)
            .bind(DEV_USER_UUID)
            .fetch_optional(pool.db())
            .await
            .map_err(AppError::from)?
    } else {
        user_row
    };

    let user = match user_row {
        Some(u) => u,
        None => return Err(AppError::NotFound("Người dùng không tồn tại".to_string())),
    };

    let specialties: Vec<String> = {
        let mut filters = Vec::new();
        if let Some(ref s) = q.specialty {
            filters.push(s.clone());
        }
        if let Some(ref major) = user.get::<Option<String>>("major") {
            filters.push(major.clone());
        }
        let skills = text_array_to_vec(user.get::<Option<String>>("skills"));
        filters.extend(skills.into_iter().take(3));
        let interests = text_array_to_vec(user.get::<Option<String>>("interests"));
        filters.extend(interests.into_iter().take(2));

        let mut seen = std::collections::HashSet::new();
        filters
            .into_iter()
            .map(|f| f.trim().to_string())
            .filter(|f| f.len() > 1)
            .filter({
                let seen = &mut seen;
                move |f| seen.insert(f.to_lowercase())
            })
            .take(5)
            .collect()
    };

    let mut filters: Vec<String> = Vec::new();
    for s in &specialties {
        let lower = esc(&s.to_lowercase());
        filters.push(format!(
            "LOWER(m.specialties::TEXT) LIKE LOWER('%{}%') OR m.specialties @> {}::jsonb",
            lower,
            json_string_literal(&lower)
        ));
    }
    if let Some(ref region) = q.region {
        let lower = esc(&region.to_lowercase());
        filters.push(format!("LOWER(m.location::TEXT) LIKE LOWER('%{}%')", lower));
    }

    let where_clause = if filters.is_empty() {
        " AND m.is_verified = true".to_string()
    } else {
        format!(" AND m.is_verified = true AND ({})", filters.join(" OR "))
    };

    let mentors = sqlx::query(&format!(
        "{}{} ORDER BY m.rating_avg DESC LIMIT {}",
        DB_MENTOR_BASE,
        where_clause,
        MAX_MENTORS_TO_LLM
    ))
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;

    if mentors.is_empty() {
        return Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Hiện chưa có mentor nào phù hợp."
        }))));
    }

    let available_mentors: Vec<serde_json::Value> = mentors
        .iter()
        .map(|row| {
            let name = row.get::<Option<String>>("full_name").unwrap_or_default();
            let specs = row
                .get::<Option<serde_json::Value>>("specialties")
                .and_then(|v| v.as_array().cloned())
                .unwrap_or_default();
            serde_json::json!({
                "mentor_id": row.get::<String>("user_id"),
                "name": name,
                "bio": row.get::<Option<String>>("bio"),
                "skills": specs.clone(),
                "mbti": user.get::<Option<String>>("mbti_type").unwrap_or_default(),
                "available_days": Vec::<String>::new(),
                "specialties": specs,
                "location": row.get::<Option<String>>("location"),
                "experience_years": row.get::<i32>("experience_years"),
                "rating_avg": row.get::<Option<String>>("rating_avg")
                    .and_then(|s| s.parse::<f64>().ok()),
            })
        })
        .collect();

    let skills = text_array_to_vec(user.get::<Option<String>>("skills"));
    let payload = serde_json::json!({
        "student_id": user_id,
        "student_skills_needed": if_empty(&skills, vec![
            "Giao tiếp".to_string(),
            "Định hướng nghề nghiệp".to_string(),
        ]),
        "student_mbti": user.get::<Option<String>>("mbti_type").unwrap_or_else(|| "ENFP".to_string()),
        "preferred_days": vec!["T7", "CN"],
        "available_mentors": available_mentors,
        "student_region": q.region,
        "student_specialty": q.specialty,
        "max_mentors": available_mentors.len().min(MAX_MENTORS_TO_LLM),
    });

    match proxy_to_ai_service("/api/ai/mentor/match", payload).await {
        Ok(data) => Ok(Json(ApiResponse::ok(data))),
        Err(err) => {
            warn!("ai-service /api/ai/mentor/match failed: {}", err);
            Ok(Json(ApiResponse::ok(degraded_matches(&user_id, &err.to_string()))))
        }
    }
}

/// `GET /api/mentoring/mentors/:mentorId/slots` — khung giờ rảnh của Mentor
/// theo ngày (loại trừ lịch đã được xác nhận).
pub async fn get_mentor_slots(
    State(pool): State<DbPool>,
    Path(mentor_id): Path<String>,
    Query(q): Query<SlotsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let date = q.date.as_deref().unwrap_or_else(|| {
        chrono::Utc::now()
            .format("%Y-%m-%d")
            .to_string()
    });
    let parsed = parse_date(date)?;
    let day_of_week = parsed.weekday().num_days_from_sunday() as i64;

    let rows = sqlx::query(DB_SLOTS)
        .bind(&mentor_id)
        .bind(&date)
        .bind(&(day_of_week as i32))
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let slots: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String>("id"),
                "start": row.get::<String>("start_time"),
                "end": row.get::<String>("end_time"),
                "is_booked": row.get::<bool>("is_booked"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "mentor_id": mentor_id,
        "date": date,
        "slots": slots,
    }))))
}

/// `POST /api/mentoring/availability` — thêm khung giờ rảnh (Mentor).
pub async fn add_availability(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<AvailabilityForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if !(0..=6).contains(&form.day_of_week) {
        return Err(AppError::BadRequest(
            "day_of_week phải nằm trong khoảng 0-6".to_string(),
        ));
    }
    if form.start_time.chars().filter(|c| *c == ':').count() != 2
        || form.end_time.chars().filter(|c| *c == ':').count() != 2
    {
        return Err(AppError::BadRequest(
            "start_time/end_time phải có dạng HH:MM".to_string(),
        ));
    }

    let inserted = sqlx::query(DB_INSERT_AVAILABILITY)
        .bind(&user.id)
        .bind(&form.day_of_week as i32)
        .bind(&form.start_time)
        .bind(&form.end_time)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": inserted.get::<String>("id"),
        "day_of_week": inserted.get::<i64>("day_of_week"),
        "start_time": inserted.get::<String>("start_time"),
        "end_time": inserted.get::<String>("end_time"),
        "is_active": inserted.get::<bool>("is_active"),
        "created_at": inserted.get::<String>("created_at"),
    }))))
}

/// `GET /api/mentoring/me/availability` — danh sách lịch rảnh của tôi.
pub async fn get_my_availability(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_AVAILABILITIES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let availabilities: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String>("id"),
                "day_of_week": row.get::<i32>("day_of_week"),
                "start_time": row.get::<String>("start_time"),
                "end_time": row.get::<String>("end_time"),
                "is_active": row.get::<bool>("is_active"),
                "created_at": row.get::<String>("created_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "mentor_id": user.id,
        "availabilities": availabilities,
    }))))
}

/// `POST /api/mentoring/book` — đặt lịch hẹn tư vấn với Mentor.
pub async fn book_session(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<BookMentorForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let mentor_id = form.mentor_id.trim().to_string();

    if user.id == mentor_id {
        return Err(AppError::BadRequest(
            "Bạn không thể tự đặt lịch với chính mình".to_string(),
        ));
    }

    let slot_start = parse_timestamp(&form.slot.start)?;
    let slot_end = parse_timestamp(&form.slot.end)?;

    if slot_end <= slot_start {
        return Err(AppError::BadRequest("slot.end phải lớn hơn slot.start".to_string()));
    }

    let mentor = sqlx::query(DB_MENTOR_BY_ID)
        .bind(&mentor_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let mentor = match mentor {
        Some(m) => m,
        None => return Err(AppError::NotFound("Mentor không tồn tại".to_string())),
    };

    let conflict = sqlx::query(DB_CONFLICT_BOOKING)
        .bind(&mentor_id)
        .bind(&slot_start)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    if conflict.is_some() {
        return Err(AppError::BadRequest("Khung giờ này đã có người đặt".to_string()));
    }

    let hourly_rate = mentor
        .get::<Option<String>>("hourly_rate")
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let saved = sqlx::query(DB_INSERT_BOOKING)
        .bind(&mentor_id)
        .bind(&user.id)
        .bind(&slot_start)
        .bind(&slot_end)
        .bind(&"pending")
        .bind(&if hourly_rate > 0.0 { "unpaid" } else { "paid" })
        .bind(&hourly_rate)
        .bind(&format!("{}{}", MEET_JITSI_PREFIX, &mentor_id[..mentor_id.len().min(8)]))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(booking_to_json(&saved))))
}

/// `PATCH /api/mentoring/bookings/:id/status` — cập nhật trạng thái lịch hẹn.
pub async fn update_booking_status(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
    Json(form): Json<UpdateBookingStatusForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_BOOKING_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Không tìm thấy lịch hẹn".to_string())),
    };

    let mentor_id = row.get::<String>("mentor_id");
    let student_id = row.get::<String>("student_id");
    let current = row.get::<String>("status");

    if user.id != mentor_id && user.id != student_id {
        ensure_admin(&user)?;
    }

    let allowed: Vec<&str> = match current.as_str() {
        "pending" => vec!["confirmed", "cancelled"],
        "confirmed" => vec!["completed", "cancelled"],
        _ => Vec::new(),
    };
    if !allowed.iter().any(|a| *a == form.status) {
        return Err(AppError::BadRequest(
            format!("Không thể chuyển trạng thái từ {} sang {}", current, form.status),
        ));
    }

    let updated = sqlx::query(DB_UPDATE_BOOKING_STATUS)
        .bind(&form.status)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(booking_to_json(&updated))))
}

/// `GET /api/mentoring/me/bookings` — lịch sử đặt lịch của tôi.
pub async fn get_my_bookings(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_STUDENT_BOOKINGS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let bookings: Vec<serde_json::Value> = rows.iter().map(booking_to_json).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": bookings.len(),
        "bookings": bookings,
    }))))
}

/// `GET /api/mentoring/student/:studentId/bookings` — lịch đặt của học sinh.
pub async fn get_student_bookings(
    State(pool): State<DbPool>,
    Path(student_id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_self_or_admin(&user, &student_id, "Bạn chỉ có thể xem lịch đặt của chính mình.")?;

    let rows = sqlx::query(DB_STUDENT_BOOKINGS)
        .bind(&student_id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let bookings: Vec<serde_json::Value> = rows.iter().map(booking_to_json).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": bookings.len(),
        "bookings": bookings,
    }))))
}

/// `GET /api/mentoring/mentor/:mentorId/bookings` — lịch hẹn của Mentor.
pub async fn get_mentor_bookings(
    State(pool): State<DbPool>,
    Path(mentor_id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_self_or_admin(&user, &mentor_id, "Bạn chỉ có thể xem lịch hẹn của chính mình.")?;

    let rows = sqlx::query(DB_MENTOR_BOOKINGS)
        .bind(&mentor_id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let bookings: Vec<serde_json::Value> = rows.iter().map(booking_to_json).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": bookings.len(),
        "bookings": bookings,
    }))))
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct MentorsQuery {
    pub specialty: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecommendQuery {
    pub specialty: Option<String>,
    pub region: Option<String>,
}