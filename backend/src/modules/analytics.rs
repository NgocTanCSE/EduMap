//! Analytics module — `/api/analytics/*`: ghi nhận sự kiện (`user_events`),
//! thống kê toàn hệ thống và thống kê giáo dục (`education_stats`).
//!
//! Mirrors `backend/src/modules/analytics/analytics.controller.ts` +
//! `analytics.service.ts`. Mọi endpoint đều công khai (old backend `@Public()`
//! trên `track`; các endpoint đọc không có guard) — thêm vào `PUBLIC_PATHS`.

use crate::common::auth::{token_from_req, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Query, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/// `POST /api/analytics/track` — body.
#[derive(Debug, Clone, Deserialize)]
pub struct TrackEventBody {
    pub event_type: String,
    pub metadata: Option<Value>,
}

/// `GET /api/analytics/stats` — không tham số (giữ signature đồng nhất).
#[derive(Debug, Clone, Deserialize)]
pub struct StatsQuery {}

/// `GET /api/analytics/education` — lọc theo năm và vùng (các filter được
//! ghép vào văn bản SQL, giống pattern `career::get_jobs`).
#[derive(Debug, Clone, Deserialize)]
pub struct EducationStatsQuery {
    pub year: Option<i64>,
    pub region: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_INSERT_EVENT: &str = r#"
INSERT INTO user_events (user_id, event_type, metadata, created_at)
VALUES ($1, $2, $3, NOW())
RETURNING id, user_id, event_type, created_at
"#;

const DB_GLOBAL_STATS: &str = r#"
SELECT
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM locations) AS total_locations,
    (SELECT COUNT(*) FROM learning_materials) AS total_materials
"#;

/// `education_stats` — `id` là SERIAL (i64), các cột thời gian đọc dưới TEXT.
const DB_EDUCATION_STATS: &str = r#"
SELECT id, region, province, district, metric_type, metric_value, year, source,
       CAST(created_at AS TEXT) AS created_at
FROM education_stats
WHERE TRUE
ORDER BY year DESC, region, metric_type
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Token tuỳ chọn: endpoint `track` là public nhưng old service vẫn cố lấy
/// `req.user?.id` (có thì dùng, không có thì bỏ qua).
fn optional_user(req: &Request) -> Option<AuthUser> {
    token_from_req(req)
}

fn sql_text(value: &str) -> String {
    value.replace('\'', "''")
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/analytics/track` — ghi nhận một sự kiện người dùng.
/// Công khai; `user_id` lấy từ JWT (nếu có) hoặc từ `metadata.userId`.
pub async fn track_event(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<TrackEventBody>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user_id = optional_user(&req)
        .map(|u| u.id)
        .or_else(|| {
            body.metadata.as_ref().and_then(|m| {
                m.get("userId")
                    .cloned()
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
            })
        });

    let row = sqlx::query(DB_INSERT_EVENT)
        .bind(user_id.as_deref())
        .bind(&body.event_type)
        .bind(body.metadata.as_ref().map(|m| m.to_string()).unwrap_or_default())
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to track event: {e}")))?;

    let result = serde_json::json!({
        "tracked": true,
        "event_type": body.event_type,
        "user_id": row.get::<Option<String>>("user_id"),
        "id": row.get::<i64>("id"),
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `GET /api/analytics/stats` — thống kê toàn hệ thống (người dùng, địa điểm,
//! tài liệu). Old backend cache 300s các bảng này; gọi trực tiếp vì dữ liệu
//! không phải điểm nóng và không dùng RLM.
pub async fn get_stats(
    State(pool): State<DbPool>,
    _query: Query<StatsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_GLOBAL_STATS)
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read global stats: {e}")))?;

    let result = serde_json::json!({
        "total_users": row.get::<i64>("total_users"),
        "total_locations": row.get::<i64>("total_locations"),
        "total_materials": row.get::<i64>("total_materials"),
        "system_ready": "100%",
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `GET /api/analytics/education?year=&region=` — thống kê giáo dục theo vùng/năm.
pub async fn get_education_stats(
    State(pool): State<DbPool>,
    Query(q): Query<EducationStatsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let filters: Vec<String> = vec![
        q.year.map(|y| format!("year = {y}")),
        q.region.as_ref().map(|r| format!("region = '{}'", sql_text(r))),
    ]
    .into_iter()
    .filter(|v| v.is_some())
    .map(|v| v.unwrap())
    .collect();

    let mut sql = DB_EDUCATION_STATS.to_string();
    if !filters.is_empty() {
        sql = sql.replace("WHERE TRUE", &format!("WHERE {}", filters.join(" AND ")));
    }

    let rows = sqlx::query(&sql)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read education stats: {e}")))?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<i64>("id"),
                "region": row.get::<Option<String>>("region"),
                "province": row.get::<Option<String>>("province"),
                "district": row.get::<Option<String>>("district"),
                "metric_type": row.get::<Option<String>>("metric_type"),
                "metric_value": row
                    .get::<Option<String>>("metric_value")
                    .and_then(|s| s.parse::<f64>().ok()),
                "year": row.get::<Option<i64>>("year"),
                "source": row.get::<Option<String>>("source"),
                "created_at": row.get::<Option<String>>("created_at"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items",
        "total": items.len() as i64,
    }))))
}