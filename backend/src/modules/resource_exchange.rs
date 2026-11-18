//! Resource Exchange module — `/api/resource-exchange/*`: nguồn lực dư thừa
//! (cung) ↔ yêu cầu cần nguồn lực (cầu) và các cặp ghép nối (AI + greedy).
//!
//! Mirrors `backend/src/modules/resource-exchange/resource-exchange.controller.ts`
//! + `resource-exchange.service.ts`. Endpoint đọc là public; write handler tự
//! kiểm JWT; `POST /match` là công khai (`@Public()`); `cached-matches` và
//! `auto-health` đọc kết quả đã được auto-scheduler tính sẵn (GET, không chờ LLM).

use crate::common::auth::{AuthUser, authenticated_user};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::{proxy_get_aiservice, proxy_to_ai_service};
use sqlx::Row;
use axum::extract::{Extension, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------


#[derive(Debug, Clone, Deserialize)]
pub struct ResourceQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub type_: Option<String>,
    pub status: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResourceRequestQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub need_type: Option<String>,
    pub status: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MatchesQuery {
    pub resource_id: Option<String>,
    pub request_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateResource {
    pub type_: String,
    pub title: String,
    pub description: Option<String>,
    pub condition: Option<i64>,
    pub location: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub available_from: Option<String>,
    pub cost: Option<f64>,
    pub contact_method: Option<String>,
    pub status: Option<String>,
    pub is_verified: Option<bool>,
    pub tags: Option<Value>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateResourceRequest {
    pub need_type: String,
    pub title: String,
    pub description: Option<String>,
    pub urgency: Option<String>,
    pub location: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub deadline: Option<String>,
    pub preferred_min_condition: Option<i64>,
    pub contact_method: Option<String>,
    pub status: Option<String>,
    pub tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResourceMatchRank {
    pub resource_type: Option<String>,
    pub need_type: Option<String>,
    pub region: Option<String>,
    pub limit: Option<i64>,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE: i64 = 1;
const DEFAULT_LIMIT: i64 = 20;

/// Shared pagination helpers (`page`/`limit`/`offset`) — implemented for every
/// query struct that carries `page` + `limit` fields.
trait Pagination {
    fn page_num(&self) -> i64 {
        self.page().unwrap_or(DEFAULT_PAGE).max(1)
    }
    fn page_limit(&self) -> i64 {
        std::cmp::min(self.limit().unwrap_or(DEFAULT_LIMIT).max(1), 100)
    }
    fn page_offset(&self) -> i64 {
        (self.page_num() - 1) * self.page_limit()
    }
    fn page(&self) -> Option<i64>;
    fn limit(&self) -> Option<i64>;
}

impl Pagination for ResourceQuery {
    fn page(&self) -> Option<i64> { self.page }
    fn limit(&self) -> Option<i64> { self.limit }
}
impl Pagination for ResourceRequestQuery {
    fn page(&self) -> Option<i64> { self.page }
    fn limit(&self) -> Option<i64> { self.limit }
}

fn sql_text(value: &str) -> String {
    value.replace('\'', "''")
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_RESOURCES: &str = r#"
SELECT id, type, title, description, condition, location, lat, lng,
       CAST(available_from AS TEXT) AS available_from, cost, contact_method,
       status, is_verified, CAST(tags AS TEXT) AS tags,
       CAST(metadata AS TEXT) AS metadata,
       CAST(created_by AS TEXT) AS created_by,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM resources
"#;

const DB_RESOURCE_BY_ID: &str = r#"SELECT * FROM resources WHERE id = $1::uuid"#;

const DB_INSERT_RESOURCE: &str = r#"
INSERT INTO resources (type, title, description, condition, location, lat, lng,
    available_from, cost, contact_method, status, is_verified, tags, metadata,
    created_by, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::uuid,NOW(),NOW())
RETURNING id
"#;

const DB_REQUESTS: &str = r#"
SELECT id, need_type, title, description, urgency, location, lat, lng,
       CAST(deadline AS TEXT) AS deadline, preferred_min_condition, contact_method,
       status, CAST(tags AS TEXT) AS tags,
       CAST(created_by AS TEXT) AS created_by,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM resource_requests
"#;

const DB_REQUEST_BY_ID: &str = r#"SELECT * FROM resource_requests WHERE id = $1::uuid"#;

const DB_INSERT_REQUEST: &str = r#"
INSERT INTO resource_requests (need_type, title, description, urgency, location,
    lat, lng, deadline, preferred_min_condition, contact_method, status, tags,
    created_by, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::uuid,NOW(),NOW())
RETURNING id
"#;

const DB_MATCHES: &str = r#"
SELECT id, CAST(resource_id AS TEXT) AS resource_id,
       CAST(request_id AS TEXT) AS request_id, match_score, explanation, status,
       CAST(scheduled_pickup AS TEXT) AS scheduled_pickup,
       CAST(transport_plan AS TEXT) AS transport_plan,
       CAST(created_by AS TEXT) AS created_by,
       CAST(created_at AS TEXT) AS created_at,
       CAST(updated_at AS TEXT) AS updated_at
FROM resource_matches
"#;

const DB_COUNT_MATCHES: &str = r#"SELECT COUNT(*) AS c FROM resource_matches"#;

// ---------------------------------------------------------------------------
// Handlers (resources)
// ---------------------------------------------------------------------------

/// `GET /api/resource-exchange/resources{?page,limit,type,status,location}`
pub async fn get_resources(
    State(pool): State<DbPool>,
    Query(q): Query<ResourceQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let filters: Vec<String> = vec![
        q.type_.as_ref().filter(|v| !v.is_empty()).map(|t| format!("type = '{}'", sql_text(t))),
        q.status.as_ref().filter(|v| !v.is_empty()).map(|s| format!("status = '{}'", sql_text(s))),
        q.location.as_ref().filter(|v| !v.is_empty()).map(|l| format!("location LIKE '%{}%'", sql_text(l))),
    ]
    .into_iter()
    .filter(Option::is_some)
    .map(Option::unwrap)
    .collect();

    let where_clause = if filters.is_empty() {
        "WHERE TRUE".to_string()
    } else {
        format!("WHERE {}", filters.join(" AND "))
    };

    let total_rows = crate::db::query(&format!("SELECT COUNT(*) AS c FROM resources {where_clause}"))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to count resources: {e}")))?;

    let total: i64 = crate::db::int(&total_rows, "c");

    let rows = crate::db::query(&format!("{DB_RESOURCES} {where_clause} ORDER BY created_at DESC LIMIT {} OFFSET {}", q.page_limit(), q.page_offset()))
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read resources: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| row_to_resource_json(&row)).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": total, "page": q.page_num(), "limit": q.page_limit() }))))
}

/// `GET /api/resource-exchange/resources/:id`
pub async fn get_resource_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_RESOURCE_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read resource: {e}")))?;
    let row = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Nguồn lực không tồn tại".to_string())),
    };
    Ok(Json(ApiResponse::ok(row_to_resource_json(&row))))
}

/// `POST /api/resource-exchange/resources`
pub async fn create_resource(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<CreateResource>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    let row = crate::db::query(DB_INSERT_RESOURCE)
        .bind(body.type_.as_str())
        .bind(body.title.as_str())
        .bind(body.description.as_deref().unwrap_or(""))
        .bind(body.condition.unwrap_or(5))
        .bind(body.location.as_str())
        .bind(body.lat)
        .bind(body.lng)
        .bind(body.available_from.as_deref())
        .bind(body.cost.unwrap_or(0.0))
        .bind(body.contact_method.as_deref().unwrap_or(""))
        .bind(body.status.as_deref().unwrap_or("available"))
        .bind(body.is_verified.unwrap_or(false))
        .bind(body.tags.as_ref().map(|t| t.to_string()).unwrap_or_default())
        .bind(body.metadata.as_ref().map(|t| t.to_string()).unwrap_or_default())
        .bind(user.id.as_str())
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create resource: {e}")))?;
    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": crate::db::text(&row, "id") }))))
}

fn row_to_resource_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "type": crate::db::opt_text(&row, "type"),
        "title": crate::db::opt_text(&row, "title"),
        "description": crate::db::opt_text(&row, "description"),
        "condition": crate::db::opt_int(&row, "condition"),
        "location": crate::db::opt_text(&row, "location"),
        "lat": crate::db::opt_num(&row, "lat"),
        "lng": crate::db::opt_num(&row, "lng"),
        "availableFrom": crate::db::opt_text(&row, "available_from"),
        "cost": crate::db::opt_num(&row, "cost"),
        "contactMethod": crate::db::opt_text(&row, "contact_method"),
        "status": crate::db::opt_text(&row, "status"),
        "isVerified": crate::db::opt_flag(&row, "is_verified"),
        "tags": crate::db::opt_text(&row, "tags").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "metadata": crate::db::opt_text(&row, "metadata").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "createdBy": crate::db::opt_text(&row, "created_by"),
        "createdAt": crate::db::opt_text(&row, "created_at"),
        "updatedAt": crate::db::opt_text(&row, "updated_at"),
    })
}

// ---------------------------------------------------------------------------
// Handlers (requests)
// ---------------------------------------------------------------------------

/// `GET /api/resource-exchange/requests{?page,limit,need_type,status,location}`
pub async fn get_resource_requests(
    State(pool): State<DbPool>,
    Query(q): Query<ResourceRequestQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let filters: Vec<String> = vec![
        q.need_type.as_ref().filter(|v| !v.is_empty()).map(|t| format!("need_type = '{}'", sql_text(t))),
        q.status.as_ref().filter(|v| !v.is_empty()).map(|s| format!("status = '{}'", sql_text(s))),
        q.location.as_ref().filter(|v| !v.is_empty()).map(|l| format!("location LIKE '%{}%'", sql_text(l))),
    ]
    .into_iter()
    .filter(Option::is_some)
    .map(Option::unwrap)
    .collect();

    let where_clause = if filters.is_empty() {
        "WHERE TRUE".to_string()
    } else {
        format!("WHERE {}", filters.join(" AND "))
    };

    let total_rows = crate::db::query(&format!("SELECT COUNT(*) AS c FROM resource_requests {where_clause}"))
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to count requests: {e}")))?;
    let total: i64 = crate::db::int(&total_rows, "c");

    let rows = crate::db::query(&format!("{DB_REQUESTS} {where_clause} ORDER BY created_at DESC LIMIT {} OFFSET {}", q.page_limit(), q.page_offset()))
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read requests: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| row_to_request_json(&row)).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": total, "page": q.page_num(), "limit": q.page_limit() }))))
}

/// `GET /api/resource-exchange/requests/:id`
pub async fn get_resource_request_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = crate::db::query(DB_REQUEST_BY_ID)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read request: {e}")))?;
    let row = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Yêu cầu không tồn tại".to_string())),
    };
    Ok(Json(ApiResponse::ok(row_to_request_json(&row))))
}

/// `POST /api/resource-exchange/requests`
pub async fn create_resource_request(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Json(body): Json<CreateResourceRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    let row = crate::db::query(DB_INSERT_REQUEST)
        .bind(body.need_type.as_str())
        .bind(body.title.as_str())
        .bind(body.description.as_deref().unwrap_or(""))
        .bind(body.urgency.as_deref().unwrap_or("medium"))
        .bind(body.location.as_str())
        .bind(body.lat)
        .bind(body.lng)
        .bind(body.deadline.as_deref())
        .bind(body.preferred_min_condition.unwrap_or(0))
        .bind(body.contact_method.as_deref().unwrap_or(""))
        .bind(body.status.as_deref().unwrap_or("open"))
        .bind(body.tags.as_ref().map(|t| t.to_string()).unwrap_or_default())
        .bind(user.id.as_str())
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create request: {e}")))?;
    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": crate::db::text(&row, "id") }))))
}

fn row_to_request_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "needType": crate::db::opt_text(&row, "need_type"),
        "title": crate::db::opt_text(&row, "title"),
        "description": crate::db::opt_text(&row, "description"),
        "urgency": crate::db::opt_text(&row, "urgency"),
        "location": crate::db::opt_text(&row, "location"),
        "lat": crate::db::opt_num(&row, "lat"),
        "lng": crate::db::opt_num(&row, "lng"),
        "deadline": crate::db::opt_text(&row, "deadline"),
        "preferredMinCondition": crate::db::opt_int(&row, "preferred_min_condition"),
        "contactMethod": crate::db::opt_text(&row, "contact_method"),
        "status": crate::db::opt_text(&row, "status"),
        "tags": crate::db::opt_text(&row, "tags").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        "createdBy": crate::db::opt_text(&row, "created_by"),
        "createdAt": crate::db::opt_text(&row, "created_at"),
        "updatedAt": crate::db::opt_text(&row, "updated_at"),
    })
}

// ---------------------------------------------------------------------------
// Handlers (matches)
// ---------------------------------------------------------------------------

/// `GET /api/resource-exchange/matches{?resource_id,request_id,status}`
pub async fn get_resource_matches(
    State(pool): State<DbPool>,
    Query(q): Query<MatchesQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let filters: Vec<String> = vec![
        q.resource_id.as_ref().filter(|v| !v.is_empty()).map(|r| format!("resource_id = '{}'::UUID", sql_text(r))),
        q.request_id.as_ref().filter(|v| !v.is_empty()).map(|r| format!("request_id = '{}'::UUID", sql_text(r))),
        q.status.as_ref().filter(|v| !v.is_empty()).map(|s| format!("status = '{}'", sql_text(s))),
    ]
    .into_iter()
    .filter(Option::is_some)
    .map(Option::unwrap)
    .collect();

    let mut sql = DB_MATCHES.to_string();
    if !filters.is_empty() {
        sql = sql.replace("FROM resource_matches", &format!("FROM resource_matches WHERE {}", filters.join(" AND ")));
    }

    let rows = crate::db::query(&format!("{sql} ORDER BY match_score DESC, created_at DESC LIMIT 100"))
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read matches: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": crate::db::text(&row, "id"),
            "resourceId": crate::db::opt_text(&row, "resource_id"),
            "requestId": crate::db::opt_text(&row, "request_id"),
            "matchScore": crate::db::opt_num(&row, "match_score"),
            "explanation": crate::db::opt_text(&row, "explanation"),
            "status": crate::db::opt_text(&row, "status"),
            "scheduledPickup": crate::db::opt_text(&row, "scheduled_pickup"),
            "transportPlan": crate::db::opt_text(&row, "transport_plan").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            "createdAt": crate::db::opt_text(&row, "created_at"),
        })
    }).collect();

    let _total_rows = crate::db::query(DB_COUNT_MATCHES)
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to count matches: {e}")))?;
    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `POST /api/resource-exchange/match` — ghép cung–cầu bằng AI (pre-filter +
// LLM ranking + greedy scheduling). Endpoint công khai (`@Public()`).
pub async fn match_resources(
    State(_pool): State<DbPool>,
    Json(body): Json<ResourceMatchRank>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let payload = serde_json::json!({
        "resource_type": body.resource_type,
        "need_type": body.need_type,
        "region": body.region,
        "limit": body.limit.unwrap_or(20),
    });
    match proxy_to_ai_service("/api/ai/resource-exchange/match-rank", payload).await {
        Ok(result) => Ok(Json(ApiResponse::ok(result))),
        Err(e) => {
            tracing::warn!("resource-exchange/match-rank ai-service unavailable: {e}; degraded");
            Ok(Json(ApiResponse::ok(serde_json::json!({
                "pairs": Vec::<Value>::new(),
                "degraded": true,
                "reason": format!("{e}"),
            }))))
        }
    }
}

/// `GET /api/resource-exchange/cached-matches{?refresh}` — kết quả auto-scheduler.
pub async fn get_cached_matches(
    State(_pool): State<DbPool>,
    Query(q): Query<RefreshQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let path = if q.refresh.unwrap_or(false) {
        "/api/ai/auto/resource-exchange/matches?refresh=true"
    } else {
        "/api/ai/auto/resource-exchange/matches"
    };
    match proxy_get_aiservice(path).await {
        Ok(result) => Ok(Json(ApiResponse::ok(result))),
        Err(e) => Err(AppError::ServiceUnavailable(format!("auto-scheduler unavailable: {e}"))),
    }
}

/// `GET /api/resource-exchange/auto-health` — trạng thái auto-scheduler.
pub async fn get_auto_health(State(_pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    match proxy_get_aiservice("/api/ai/auto/health").await {
        Ok(result) => Ok(Json(ApiResponse::ok(result))),
        Err(e) => Err(AppError::ServiceUnavailable(format!("auto-scheduler unavailable: {e}"))),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RefreshQuery {
    pub refresh: Option<bool>,
}