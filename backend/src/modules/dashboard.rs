//! Dashboard module — `/api/dashboard/*`: tổng quan cá nhân, lời khuyên AI mỗi
//! ngày, lịch sử đăng ký/ứng tuyển và thống kê admin (heatmap giáo dục).
//!
//! Mirrors `backend/src/modules/dashboard/dashboard.controller.ts` +
//! `dashboard.service.ts`. Ba endpoint đầu cần JWT (class-level
//! `@UseGuards(JwtAuthGuard)`); `stats` dành riêng cho admin/moderator.

use crate::common::auth::{ensure_admin, authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::extract::State;
use axum::http::Request;
use axum::Json;
use serde_json::Value;

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

/// `GET /api/dashboard/overview` — tất cả trong một lần round-trip.
const DB_DASHBOARD_OVERVIEW: &str = r#"
WITH user_base AS (
    SELECT id, full_name, email, avatar_url, role FROM users WHERE id = $1
), learning AS (
    SELECT COUNT(*) AS c FROM user_learning_history WHERE user_id = $1
), skills AS (
    SELECT COUNT(*) AS c FROM user_skills WHERE user_id = $1
), posts_c AS (
    SELECT COUNT(*) AS c FROM posts WHERE author_id = $1
), comments_c AS (
    SELECT COUNT(*) AS c FROM comments WHERE author_id = $1
), certs AS (
    SELECT COUNT(*) AS c FROM user_certificates WHERE user_id = $1 AND status = 'active'
), goals AS (
    SELECT id, goal_title, description, status, target_date,
           CAST(created_at AS TEXT) AS created_at
    FROM user_careers WHERE user_id = $1 AND status = 'active' LIMIT 3
), bookings_f AS (
    SELECT b.id, b.slot_start, b.meeting_url, u.full_name AS mentor_name
    FROM bookings b
    JOIN mentors m ON m.user_id = b.mentor_id
    JOIN users u ON u.id = m.user_id
    WHERE b.student_id = $1 AND b.status = 'confirmed'
      AND b.slot_start >= $2::TIMESTAMP WITH TIME ZONE
    ORDER BY b.slot_start ASC LIMIT 3
)
SELECT
    (SELECT row_to_json(u) FROM user_base u) AS "user",
    (SELECT json_build_object(
        'learning_materials', l.c,
        'skills_mastered', sk.c,
        'community_contributions', p.c + co.c,
        'certificates_earned', c.c
    ) FROM learning l, skills sk, posts_c p, comments_c co, certs c) AS "stats",
    (SELECT json_agg(g) FROM goals g) AS "active_goals",
    (SELECT json_agg(b) FROM bookings_f b) AS "upcoming_mentoring"
"#;

/// `GET /api/dashboard/history` — lịch sử ứng tuyển/đăng ký, gom UNION.
const DB_DASHBOARD_HISTORY: &str = r#"
SELECT type, title, status, CAST(created_at AS TEXT) AS created_at FROM (
    SELECT 'application' AS type, j.title, a.status, a.created_at
    FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.user_id = $1
    UNION ALL
    SELECT 'registration', e.title, er.status, er.created_at
    FROM event_registrations er JOIN events e ON e.id = er.event_id WHERE er.user_id = $1
    UNION ALL
    SELECT 'intern_application', i.title, ia.status, ia.created_at
    FROM internship_applications ia JOIN internships i ON i.id = ia.internship_id
    WHERE ia.user_id = $1
    UNION ALL
    SELECT 'scholar_application', s.title, sa.status, sa.created_at
    FROM scholarship_applications sa JOIN scholarships s ON s.id = sa.scholarship_id
    WHERE sa.student_id = $1
    UNION ALL
    SELECT 'summer_registration', CAST(cr.campaign_id AS TEXT), cr.status, cr.created_at
    FROM summer_registrations cr WHERE cr.user_id = $1
) t ORDER BY created_at DESC
"#;

/// `GET /api/dashboard/stats` — thống kê admin.
const DB_STATS_USERS: &str = r#"SELECT COUNT(*) AS c FROM users"#;
const DB_STATS_EVENTS: &str = r#"SELECT COUNT(*) AS c FROM user_events"#;
const DB_STATS_ROLES: &str = r#"SELECT role, COUNT(*) AS c FROM users GROUP BY role"#;
const DB_STATS_TREND: &str = r#"
SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS c FROM users
GROUP BY month ORDER BY month ASC
"#;
const DB_STATS_TOP_EVENTS: &str = r#"
SELECT event_type AS type, COUNT(*) AS c FROM user_events
GROUP BY event_type ORDER BY c DESC LIMIT 5
"#;
const DB_STATS_EDUCATION: &str = r#"
SELECT metric_type, metric_value FROM education_stats LIMIT 10
"#;
const DB_STATS_HEATMAP: &str = r#"
SELECT ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat,
       type_id AS category FROM map_points WHERE location IS NOT NULL LIMIT 500
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn today_midnight() -> String {
    let now = chrono::Utc::now();
    let midnight = now.date_naive().and_hms_opt(0, 0, 0).unwrap()
        .and_utc()
        .to_rfc3339_opt()
        .unwrap_or_else(|| now.to_rfc3339());
    midnight
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/dashboard/overview` — tổng quan cá nhân hoá cho người dùng.
pub async fn get_overview(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let today = today_midnight();

    let row = sqlx::query(DB_DASHBOARD_OVERVIEW)
        .bind(user.id.as_str())
        .bind(&today)
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to load dashboard: {e}")))?;

    let parse_opt = |row: &sqlx::postgres::PgRow, key: &str| -> Option<Value> {
        row.get::<Option<String>>(key).and_then(|s| serde_json::from_str(&s).ok())
    };

    let result = serde_json::json!({
        "user": parse_opt(&row, "user").unwrap_or_default(),
        "stats": parse_opt(&row, "stats").unwrap_or_default(),
        "active_goals": parse_opt(&row, "active_goals").unwrap_or_else(|| serde_json::Value::Array(vec![])),
        "upcoming_mentoring": parse_opt(&row, "upcoming_mentoring").unwrap_or_else(|| serde_json::Value::Array(vec![])),
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `GET /api/dashboard/insight` — lời khuyên AI mỗi ngày (proxy ai-service).
/// Khi ai-service không phản hồi, trả về mẫu fallback để không 502.
pub async fn get_daily_insight(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let today = today_midnight();

    let row = sqlx::query(DB_DASHBOARD_OVERVIEW)
        .bind(user.id.as_str())
        .bind(&today)
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to load dashboard: {e}")))?;

    let parse_opt = |key: &str| -> Option<Value> {
        row.get::<Option<String>>(key).and_then(|s| serde_json::from_str(&s).ok())
    };

    let payload = serde_json::json!({
        "dashboard_data": parse_opt("user").unwrap_or_default(),
    });

    match proxy_to_ai_service("/api/ai/analytics/daily-insight", payload).await {
        Ok(insight) => Ok(Json(ApiResponse::ok(insight))),
        Err(e) => {
            tracing::warn!("daily-insight ai-service unavailable: {e}; falling back to template");
            Ok(Json(ApiResponse::ok(serde_json::json!({
                "motivation_message": "Hãy tiếp tục học tập và theo dõi tiến độ của bạn trên EduMap.",
                "suggested_action": "Xem lại các khóa học đã lưu hoặc khám phá sự kiện sắp tới.",
                "degraded": true,
            }))))
        }
    }
}

/// `GET /api/dashboard/history` — lịch sử đăng ký/ứng tuyển (jobs, events,
// intern, scholarship, summer).
pub async fn get_history(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_DASHBOARD_HISTORY)
        .bind(user.id.as_str())
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to load history: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "type": row.get::<String>("type"),
            "title": row.get::<Option<String>>("title"),
            "status": row.get::<Option<String>>("status"),
            "created_at": row.get::<Option<String>>("created_at"),
        })
    }).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `GET /api/dashboard/stats` — thống kê thời gian thực + tọa độ heatmap
// giáo dục (chỉ admin/moderator).
pub async fn get_stats(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let user_count = sqlx::query(DB_STATS_USERS)
        .fetch_one(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .get::<i64>("c");
    let event_count = sqlx::query(DB_STATS_EVENTS)
        .fetch_one(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .get::<i64>("c");

    let roles: Vec<Value> = sqlx::query(DB_STATS_ROLES)
        .fetch_all(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .into_iter().map(|row| {
            serde_json::json!({ "role": row.get::<String>("role"), "count": row.get::<i64>("c") })
        }).collect();

    let trend: Vec<Value> = sqlx::query(DB_STATS_TREND)
        .fetch_all(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .into_iter().map(|row| {
            serde_json::json!({ "month": row.get::<Option<String>>("month"), "count": row.get::<i64>("c") })
        }).collect();

    let top_events: Vec<Value> = sqlx::query(DB_STATS_TOP_EVENTS)
        .fetch_all(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .into_iter().map(|row| {
            serde_json::json!({ "type": row.get::<Option<String>>("type"), "count": row.get::<i64>("c") })
        }).collect();

    let education: Vec<Value> = sqlx::query(DB_STATS_EDUCATION)
        .fetch_all(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .into_iter().map(|row| {
            serde_json::json!({
                "metric_type": row.get::<Option<String>>("metric_type"),
                "metric_value": row.get::<Option<String>>("metric_value"),
            })
        }).collect();

    let heatmap: Vec<Value> = sqlx::query(DB_STATS_HEATMAP)
        .fetch_all(pool.db()).await.map_err(|e| AppError::Internal(e.to_string()))?
        .into_iter().map(|row| {
            serde_json::json!({
                "lat": row.get::<f64>("lat"),
                "lng": row.get::<f64>("lng"),
                "category": row.get::<Option<i64>>("category"),
                "intensity": 0.8f64,
            })
        }).collect();

    let enrollment = education.iter().find(|e| e["metric_type"] == "enrollment_rate");
    let adoption = education.iter().find(|e| e["metric_type"] == "adoption_score");

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "overview": {
            "total_users": user_count,
            "total_events": event_count,
        },
        "charts": {
            "user_roles": roles,
            "growth_trend": trend.iter().rev().cloned().collect::<Vec<_>>(),
            "top_activities": top_events,
        },
        "heatmap": heatmap,
        "education_metrics": {
            "enrollment_rate": enrollment.map_or("0%".to_string(), |e| format!("{}%", e["metric_value"])),
            "adoption_score": adoption.map_or("0/10".to_string(), |e| format!("{}/10", e["metric_value"])),
        },
    }))))
}