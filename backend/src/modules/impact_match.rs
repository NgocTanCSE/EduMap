//! ImpactMatch module — `/api/impact-match/*` (Idea #9): ghép nối `need` ↔
//! `sponsor` — nhu cầu tài trợ của các trường/địa phương với các nhà tài trợ
//! có tiềm năng (học bổng, thiết bị, cơ sở hạ tầng, phúc lợi xã hội...).
//!
//! Mirrors `backend/src/modules/impact-match/impact-match.controller.ts` +
//! `impact-match.service.ts` (old NestJS):
//! - `GET /api/impact-match/needs{,/:id}` — danh sách/chi tiết nhu cầu cần tài trợ
//! - `POST /api/impact-match/needs` — tạo nhu cầu mới (dưới JWT)
//! - `GET /api/impact-match/sponsors{,/:id}` — danh sách/chi tiết nhà tài trợ
//! - `POST /api/impact-match/sponsors` — tạo hồ sơ nhà tài trợ (dưới JWT)
//! - `POST /api/impact-match/rank` — pre-filter SQLite + AI xếp hạng: các cặp
//!   được gửi vào `POST /api/ai/impactmatch/rank` của ai-service, rồi trả về
//!   `{ranked_matches, pre_filter_summary, degraded, reason}` (cùng hình dạng
//!   như old backend; `degraded=true` khi AI không trả lời được)
//! - `GET /api/impact-match/rankings/cached` — kết quả auto-scheduler của
//!   ai-service (`GET /api/ai/auto/impact-match/rankings`, đã tính sẵn, không
//!   chờ LLM)
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị
//! cấm). Postgres-only.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::{proxy_get_aiservice_response, proxy_to_ai_service};
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{Request<Body>, Response<Body>};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use tracing::error;
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập (các endpoint write tự kiểm JWT, 401 nếu thiếu).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// `GET /api/impact-match/needs` — bộ lọc danh sách (page/limit).
#[derive(Debug, Deserialize)]
struct NeedListQuery {
    #[serde(default)]
    page: Option<i64>,
    #[serde(default)]
    limit: Option<i64>,
    category: Option<String>,
    status: Option<String>,
    urgency: Option<String>,
    location: Option<String>,
}

/// `GET /api/impact-match/sponsors` — bộ lọc danh sách (page/limit).
#[derive(Debug, Deserialize)]
struct SponsorListQuery {
    #[serde(default)]
    page: Option<i64>,
    #[serde(default)]
    limit: Option<i64>,
    focus_area: Option<String>,
    location: Option<String>,
    is_verified: Option<String>,
}

/// `POST /api/impact-match/rank` — những tiêu chí xếp hạng.
#[derive(Debug, Deserialize)]
struct RankQuery {
    region: Option<String>,
    category: Option<String>,
    max_results: Option<i64>,
    max_cost: Option<f64>,
}

/// `GET /api/impact-match/rankings/cached?refresh=` — bộ lọc cache
/// auto-scheduler.
#[derive(Debug, Deserialize)]
struct CachedRankQuery {
    refresh: Option<String>,
}

/// `POST /api/impact-match/needs` (dưới JWT).
#[derive(Debug, Deserialize)]
struct CreateNeedForm {
    title: String,
    description: Option<String>,
    category: String,
    urgency: Option<String>,
    cost_estimate: Option<f64>,
    location: Option<String>,
    tags: Option<Vec<String>>,
    apply_url: Option<String>,
}

/// `POST /api/impact-match/sponsors` (dưới JWT).
#[derive(Debug, Deserialize)]
struct CreateSponsorForm {
    name: String,
    description: Option<String>,
    focus_areas: Vec<String>,
    budget_amount: Option<f64>,
    budget_currency: Option<String>,
    location: Option<String>,
    website_url: Option<String>,
    contact_email: Option<String>,
    is_verified: Option<bool>,
    status: Option<String>,
}

/// Một cặp ứng viên đã pre-filter (need ↔ sponsor), có điểm tiền lọc.
/// `need`/`sponsor` là các JSON blob ( Từ `need_to_json` / `sponsor_to_json`);
/// `tags`/`focus_areas` đã là mảng JSON, không phải text JSONB nữa.
#[derive(Debug, Clone)]
struct CandidatePair {
    need_id: String,
    sponsor_id: String,
    need: Value,
    sponsor: Value,
    category_match: bool,
    match_score: f64,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// JSONB `tags`/`focus_areas` về dưới dạng JSON text; parse thành mảng JSON
/// (`tags: string[]` ở phía frontend) — lại là chuỗi nguyên văn nếu JSONB có
/// thứ gì đó bất ngờ.
fn json_tags(raw: Option<String>) -> Value {
    match raw {
        Some(s) if !s.trim().is_empty() => {
            serde_json::from_str(&s).unwrap_or(Value::String(s))
        }
        _ => Value::Array(vec![]),
    }
}

/// Trước khi binding vào cột JSONB, serialize mảng thành JSON text (Postgres
/// implicit-cast `text :: jsonb`).
fn json_tags_text(tags: Option<&Vec<String>>) -> Option<String> {
    match tags {
        Some(tags) => serde_json::to_string(tags).ok(),
        None => None,
    }
}

/// Tìm một phần tử của mảng JSON — `true` nếu một trong các phần tử so khớp.
fn json_array_contains(value: &Value, needle: &str) -> bool {
    match value {
        Value::Array(items) => items.iter().any(|item| item.as_str() == Some(needle)),
        _ => false,
    }
}

/// Extract a string field from an ai-service `need`/`sponsor` JSON blob.
fn vtext(v: &Value, key: &str) -> String {
    v.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string()
}

/// Extract a number field from an ai-service `need`/`sponsor` JSON blob.
fn vnum(v: &Value, key: &str) -> f64 {
    v.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
}

/// Extract a bool field from an ai-service `need`/`sponsor` JSON blob.
fn vbool(v: &Value, key: &str) -> bool {
    v.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_NEEDS: &str = r#"
    SELECT id, title, description, category, urgency, cost_estimate, location,
           status, tags, apply_url, provenance, created_by,
           CAST(created_at AS TEXT) AS created_at
    FROM sponsor_needs
    WHERE deleted_at IS NULL AND status != 'closed'
"#;

/// Chỉ `status = 'open'` (giống old `rankMatches` dùng `need.status = :status`).
const DB_SELECT_NEEDS_OPEN: &str = r#"
    SELECT id, title, description, category, urgency, cost_estimate, location,
            status, tags, apply_url, provenance, created_by,
            CAST(created_at AS TEXT) AS created_at
    FROM sponsor_needs
    WHERE deleted_at IS NULL AND status = 'open'
"#;

const DB_COUNT_NEEDS: &str = r#"
    SELECT COUNT(*) FROM sponsor_needs
    WHERE deleted_at IS NULL AND status != 'closed'
"#;

const DB_SELECT_NEED_BY_ID: &str = r#"
    SELECT id, title, description, category, urgency, cost_estimate, location,
           status, tags, apply_url, provenance, created_by,
           CAST(created_at AS TEXT) AS created_at
    FROM sponsor_needs
    WHERE id = $1 AND deleted_at IS NULL
"#;

const DB_INSERT_NEED: &str = r#"
    INSERT INTO sponsor_needs
        (title, description, category, urgency, cost_estimate, location,
         tags, apply_url, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING id, title, description, category, urgency, cost_estimate, location,
              status, tags, apply_url, provenance, created_by,
              CAST(created_at AS TEXT) AS created_at
"#;

/// Một hàng sponsor (dùng cho `list` + `detail`); chỉ status `active` ở danh
/// sách, chi tiết thì không lọc status (như `findOne({ where: { id } })` cũ).
const DB_SELECT_SPONSORS: &str = r#"
    SELECT id, name, description, focus_areas, budget_amount, budget_currency,
           location, status, is_verified, created_by,
           CAST(created_at AS TEXT) AS created_at
    FROM sponsor_profiles
    WHERE status = 'active'
"#;

const DB_COUNT_SPONSORS: &str = r#"
    SELECT COUNT(*) FROM sponsor_profiles WHERE status = 'active'
"#;

const DB_SELECT_SPONSOR_BY_ID: &str = r#"
    SELECT id, name, description, focus_areas, budget_amount, budget_currency,
           location, status, is_verified, created_by,
           CAST(created_at AS TEXT) AS created_at
    FROM sponsor_profiles
    WHERE id = $1
"#;

const DB_INSERT_SPONSOR: &str = r#"
    INSERT INTO sponsor_profiles
        (name, description, focus_areas, budget_amount, budget_currency, location,
         website_url, contact_email, created_by, status, is_verified,
         created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, NOW(), NOW())
    RETURNING id, name, description, focus_areas, budget_amount, budget_currency,
              location, status, is_verified, created_by,
              CAST(created_at AS TEXT) AS created_at
"#;

// ---------------------------------------------------------------------------
// Filters (text masks + vai trò của bind là limit/offset)
// ---------------------------------------------------------------------------

/// Các lọc text hỏa thể: `category`, `status`, `urgency` (bằng), `location`
/// (LIKE). Chỉ `limit`/`offset` là bind — pattern giống `career.rs`.
fn where_clauses_need(q: &NeedListQuery) -> Vec<String> {
    let mut filters: Vec<String> = Vec::new();

    if let Some(category) = q.category.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "LOWER(category) = '{}'",
            category.trim().to_lowercase().replace('\'', "''")
        ));
    }

    if let Some(status) = q.status.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "LOWER(status) = '{}'",
            status.trim().to_lowercase().replace('\'', "''")
        ));
    }

    if let Some(urgency) = q.urgency.as_ref().filter(|v| !v.trim().is_empty()) {
        filters.push(format!(
            "LOWER(urgency) = '{}'",
            urgency.trim().to_lowercase().replace('\'', "''")
        ));
    }

    if let Some(location) = q.location.as_ref().filter(|v| !v.trim().is_empty()) {
        let loc = format!("%{}%", location.trim()).replace('\'', "''");
        filters.push(format!("LOWER(location) LIKE LOWER('{}')", loc));
    }

    filters
}

/// Các lọc text hỏa thể: `focus_area` (LIKE trên JSON text), `location` (LIKE),
/// `is_verified`. Chỉ `limit`/`offset` là bind.
fn where_clauses_sponsor(q: &SponsorListQuery) -> Vec<String> {
    let mut filters: Vec<String> = Vec::new();

    if let Some(focus_area) = q.focus_area.as_ref().filter(|v| !v.trim().is_empty()) {
        let fa = format!("%{}%", focus_area.trim().to_lowercase()).replace('\'', "''");
        // `focus_areas` là JSONB: ép về text tránh `lower(jsonb) is not supported`.
        filters.push(format!(
            "LOWER(focus_areas::text) LIKE LOWER('{}')",
            fa
        ));
    }

    if let Some(location) = q.location.as_ref().filter(|v| !v.trim().is_empty()) {
        let loc = format!("%{}%", location.trim()).replace('\'', "''");
        filters.push(format!("LOWER(location) LIKE LOWER('{}')", loc));
    }

    if let Some(is_verified) = q.is_verified.as_ref().filter(|v| !v.trim().is_empty()) {
        let verified = is_verified.trim().to_lowercase() == "true";
        filters.push(format!("is_verified = {}", if verified { "true" } else { "false" }));
    }

    filters
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/// `GET /api/impact-match/needs` — danh sách nhu cầu (phân trang, lọc theo
/// category/status/urgency/location). Public (like old `@Get('needs')`).
pub async fn get_needs(
    State(pool): State<DbPool>,
    Query(q): Query<NeedListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let limit = q.limit.unwrap_or(20).clamp(1, 50);
    let page = q.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;
    let where_clause = where_clauses_need(&q);
    let where_clause = if where_clause.is_empty() {
        String::new()
    } else {
        format!(" AND ({})", where_clause.join(" AND "))
    };

    // `COUNT(*)` trên cùng điều kiện (lọc text = literal text, bind duy nhất
    // `limit`/`offset`).
    let count_sql = format!("{}{}", DB_COUNT_NEEDS, where_clause);
    let total: i64 = sqlx::query(&count_sql)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>(0);

    let list_sql = format!("{}{}", DB_SELECT_NEEDS, where_clause);
    let list_sql = format!("{} ORDER BY created_at DESC LIMIT $1 OFFSET $2", list_sql);
    let rows = sqlx::query(&list_sql)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(need_to_json).collect::<Vec<_>>(),
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (((total as f64) / (limit as f64)).ceil() as i64).max(1),
        },
    }))))
}

/// `GET /api/impact-match/needs/:id` — chi tiết một nhu cầu (404 khi có).
pub async fn get_need_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_NEED_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match row {
        Some(row) => Ok(Json(ApiResponse::ok(need_to_json(&row)))),
        None => Err(AppError::NotFound("Nhu cầu không tồn tại.".to_string())),
    }
}

/// `POST /api/impact-match/needs` — tạo nhu cầu mới (dưới JWT, kiểm bằng
/// `authenticated_user`).
pub async fn create_need(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateNeedForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.title.trim().is_empty() || form.category.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Tiêu đề và danh mục là bắt buộc.".to_string(),
        ));
    }

    let tags = json_tags_text(form.tags.as_ref());
    let inserted = sqlx::query(DB_INSERT_NEED)
        .bind(&form.title)
        .bind(&form.description)
        .bind(&form.category)
        .bind(form.urgency.as_deref().unwrap_or("medium"))
        .bind(&form.cost_estimate.unwrap_or(0.0))
        .bind(&form.location)
        .bind(tags.as_deref())
        .bind(&form.apply_url)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "need": need_to_json(&inserted),
    }))))
}

/// `GET /api/impact-match/sponsors` — danh sách nhà tài trợ (phân trang, lọc
/// theo focus_area/location/is_verified). Public (like old `@Get('sponsors')`).
pub async fn get_sponsors(
    State(pool): State<DbPool>,
    Query(q): Query<SponsorListQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let limit = q.limit.unwrap_or(20).clamp(1, 50);
    let page = q.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;
    let where_clause = where_clauses_sponsor(&q);
    let where_clause = if where_clause.is_empty() {
        String::new()
    } else {
        format!(" AND ({})", where_clause.join(" AND "))
    };

    let count_sql = format!("{}{}", DB_COUNT_SPONSORS, where_clause);
    let total: i64 = sqlx::query(&count_sql)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<i64>(0);

    let list_sql = format!("{}{}", DB_SELECT_SPONSORS, where_clause);
    let list_sql = format!("{} ORDER BY budget_amount DESC LIMIT $1 OFFSET $2", list_sql);
    let rows = sqlx::query(&list_sql)
        .bind(&limit)
        .bind(&offset)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(sponsor_to_json).collect::<Vec<_>>(),
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (((total as f64) / (limit as f64)).ceil() as i64).max(1),
        },
    }))))
}

/// `GET /api/impact-match/sponsors/:id` — chi tiết một nhà tài trợ (404 khi có).
pub async fn get_sponsor_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_SPONSOR_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    match row {
        Some(row) => Ok(Json(ApiResponse::ok(sponsor_to_json(&row)))),
        None => Err(AppError::NotFound("Nhà tài trợ không tồn tại.".to_string())),
    }
}

/// `POST /api/impact-match/sponsors` — tạo hồ sơ nhà tài trợ (dưới JWT).
pub async fn create_sponsor(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateSponsorForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Tên nhà tài trợ là bắt buộc.".to_string(),
        ));
    }

    let focus_areas = json_tags_text(Some(&form.focus_areas));
    let inserted = sqlx::query(DB_INSERT_SPONSOR)
        .bind(&form.name)
        .bind(&form.description)
        .bind(focus_areas.as_deref())
        .bind(&form.budget_amount.unwrap_or(0.0))
        .bind(&form.budget_currency.unwrap_or("VND".to_string()))
        .bind(&form.location)
        .bind(&form.website_url)
        .bind(&form.contact_email)
        .bind(&user.id)
        .bind(&form.is_verified.unwrap_or(false))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "sponsor": sponsor_to_json(&inserted),
    }))))
}

// ---------------------------------------------------------------------------
// Item mappers
// ---------------------------------------------------------------------------

fn need_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<String>("title"),
        "description": row.get::<Option<String>>("description"),
        "category": row.get::<String>("category"),
        "urgency": row.get::<String>("urgency"),
        "cost_estimate": row.get::<f64>("cost_estimate"),
        "location": row.get::<Option<String>>("location"),
        "status": row.get::<String>("status"),
        "tags": json_tags(row.get::<Option<String>>("tags")),
        "apply_url": row.get::<Option<String>>("apply_url"),
        "provenance": row.get::<Option<String>>("provenance"),
        "created_by": row.get::<Option<String>>("created_by"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn sponsor_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "focus_areas": json_tags(row.get::<Option<String>>("focus_areas")),
        "budget_amount": row.get::<f64>("budget_amount"),
        "budget_currency": row.get::<String>("budget_currency"),
        "location": row.get::<Option<String>>("location"),
        "status": row.get::<String>("status"),
        "is_verified": row.get::<bool>("is_verified"),
        "created_by": row.get::<Option<String>>("created_by"),
        "created_at": row.get::<String>("created_at"),
    })
}

// ---------------------------------------------------------------------------
// Ranking (pre-filter + ai-service)
// ---------------------------------------------------------------------------

/// Pre-filter và xếp hạng các cặp nhu cầu ↔ nhà tài trợ (giống old
/// `impact-match.service.ts` `rankMatches()`):
///
/// 1. Lấy `needs` (status open, chưa xóa) + `sponsors` (status active) từ
///    SQLite, lọc loại:
///    - `budget_amount >= cost_estimate`
///    - `region` (LIKE location của nhu cầu — `region` tương ứng `location`)
///    - `category` (bằng, case-insensitive)
///    - `max_cost`
/// 2. Candidate pairs (tối đa 15) gửi vào ai-service `POST
///    /api/ai/impactmatch/rank` — LLM xếp hạng 0-100.
/// 3. Trả về `{ranked_matches, pre_filter_summary, degraded, reason}`; khi
///    ai-service trả lời được (`degraded=true`) — endpoint không bao giờ
///    502.
pub async fn rank(
    State(pool): State<DbPool>,
    Json(q): Json<RankQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let region = q.region.as_deref().filter(|v| !v.trim().is_empty());
    let category = q.category.as_deref().filter(|v| !v.trim().is_empty());
    let max_results = q.max_results.unwrap_or(15).clamp(1, 15);
    let max_cost = q.max_cost;

    // A `max_cost` → fetch up to 200 (like old `rankMatches`), otherwise 50.
    let fetch_limit: i64 = match max_cost {
        Some(c) if c > 0.0 => 200,
        _ => 50,
    };
    let need_rows = sqlx::query(format!("{} ORDER BY created_at DESC LIMIT $1", DB_SELECT_NEEDS_OPEN))
        .bind(&fetch_limit)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let sponsor_rows = sqlx::query(format!(
        "{} ORDER BY budget_amount DESC LIMIT $1",
        DB_SELECT_SPONSORS
    ))
    .bind(&50i64)
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;

    let needs: Vec<Value> = need_rows.iter().map(need_to_json).collect();
    let sponsors: Vec<Value> = sponsor_rows.iter().map(sponsor_to_json).collect();

    // Pre-filter (sống theo opcode cũ): budget >= cost, region, category,
    // max_cost. Tính điểm tiền lọc (giống ai-service `_run_impact_match`).
    let mut pairs: Vec<CandidatePair> = Vec::new();
    for need in &needs {
        let need_id = vtext(need, "id");
        let need_cat = vtext(need, "category").to_lowercase();
        let need_cost = vnum(need, "cost_estimate");
        let need_loc = vtext(need, "location").to_lowercase();

        if let Some(max_cost) = max_cost {
            if need_cost > max_cost {
                continue;
            }
        }
        if let Some(region) = region {
            if !need_loc.is_empty() && !need_loc.contains(region) {
                continue;
            }
        }
        if let Some(category) = category {
            if need_cat != category.to_lowercase() {
                continue;
            }
        }

        for sponsor in &sponsors {
            let budget = vnum(sponsor, "budget_amount");
            if budget < need_cost {
                continue;
            }
            let sponsor_id = vtext(sponsor, "id");
            let spon_loc = vtext(sponsor, "location").to_lowercase();

            // category affiliation: `category` hoặc bất kỳ `tag` nào của
            // nhu cầu nằm trong `focus_areas` của sponsor.
            let mut category_match = false;
            if !need_cat.is_empty() {
                // `focus_areas` của `sponsor` là blob JSON (mảng) từ
                // `sponsor_to_json` — không parse lại từ text JSONB.
                let focus_areas = sponsor.get("focus_areas").cloned().unwrap_or(Value::Array(vec![]));
                if json_array_contains(&focus_areas, &need_cat) {
                    category_match = true;
                } else {
                    // `tags` của `need` cũng là blob JSON (mảng) hiện có.
                    let need_tags = need.get("tags").cloned().unwrap_or(Value::Array(vec![]));
                    if let Some(ts) = need_tags.as_array() {
                        for t in ts {
                            if json_array_contains(&focus_areas, t.as_str().unwrap_or("")) {
                                category_match = true;
                                break;
                            }
                        }
                    }
                }
            }

            // Điểm tiền lọc (giống ai-service `_run_impact_match`):
            // proximity + budget_fit + category_score + urgency + verified.
            let proximity = if !need_loc.is_empty()
                && !spon_loc.is_empty()
                && (need_loc.contains(spon_loc) || spon_loc.contains(need_loc))
            {
                30.0
            } else {
                10.0
            };
            let budget_fit = if need_cost > 0.0 {
                f64::min(30.0, (budget / need_cost) * 15.0 + 15.0)
            } else {
                30.0
            };
            let category_score = if category_match { 20.0 } else { 5.0 };
            let urgency_weight = match vtext(need, "urgency").to_lowercase().as_str() {
                "critical" => 4.0,
                "high" => 3.0,
                "medium" => 2.0,
                "low" => 1.0,
                _ => 2.0,
            };
            let urgency_score = urgency_weight / 4.0 * 20.0;
            let verified_score = if vbool(sponsor, "is_verified") { 5.0 } else { 0.0 };
            let total = f64::min(100.0, proximity + budget_fit + category_score
                + urgency_score + verified_score).round(1);

            pairs.push(CandidatePair {
                need_id,
                sponsor_id,
                need: need.clone(),
                sponsor: sponsor.clone(),
                category_match,
                match_score: total,
            });
        }
    }

    let total_needs = needs.len();
    let total_sponsors = sponsors.len();
    let pre_filtered_pairs = pairs.len();

    // Cắt hết (hoặc ít hơn) `max_results` cặp gửi vào LLM.
    let cap = (max_results as usize).min(pairs.len());
    let limited_pairs = &pairs[..cap];
    let max_pairs = limited_pairs.len();

    // Khi không có cặp nào phù hợp (hoặc đứt thao tác), trả kết quả rỗng.
    if limited_pairs.is_empty() {
        return Ok(Json(ApiResponse::ok(serde_json::json!({
            "ranked_matches": Vec::<Value>::new(),
            "pre_filter_summary": {
                "total_needs": total_needs,
                "total_sponsors": total_sponsors,
                "pre_filtered_pairs": pre_filtered_pairs,
                "max_pairs": 0,
            },
            "degraded": false,
        }))))
    }

    // Gửi những cặp pre-filter lọc vào ai-service `POST
    // /api/ai/impactmatch/rank` (dạng – cặp nhu cầu ↔ nhà tài trợ + vùng/lọc).
    let pairs_json: Vec<Value> = limited_pairs
        .iter()
        .map(|p| serde_json::json!({
            "need_id": p.need_id,
            "sponsor_id": p.sponsor_id,
            "need": p.need.clone(),
            "sponsor": p.sponsor.clone(),
            "category_match": p.category_match,
        }))
        .collect();

    let payload = serde_json::json!({
        "pairs": pairs_json,
        "region": region,
        "category": category,
        "max_results": max_results,
    });

    let ai_result = match proxy_to_ai_service("/api/ai/impactmatch/rank", payload).await {
        Ok(v) => v,
        Err(e) => {
            // Trả về kết quả dự phòng (degraded): `degraded=true` +
            // `pre_filter_summary` + `ranked_matches=[]` — liên tục trả kết
            // quả, không bao giờ 503 (`ranked_matches` rỗng).
            error!("impact-match rank ai-service failed: {}", e);
            serde_json::json!({
                "ranked_matches": Vec::<Value>::new(),
                "pre_filter_summary": {
                    "total_needs": total_needs,
                    "total_sponsors": total_sponsors,
                    "pre_filtered_pairs": pre_filtered_pairs,
                    "max_pairs": max_pairs,
                },
                "degraded": true,
                "reason": format!("Dịch vụ AI không khả dụng (impact-match ranking): {}", e),
            })
        }
    };

    // Map các cặp LLM → hình dạng old backend: `ranked_matches` +
    // `need`/`sponsor` chi tiết (từ các cặp pre-filter đã giữ).
    let mut ranked: Vec<Value> = Vec::new();
    let mut need_map: HashMap<String, &CandidatePair> = HashMap::new();
    for p in &pairs {
        need_map.insert(format!("{}:{}", p.need_id, p.sponsor_id), p);
    }

    if let Some(matches) = ai_result.get("ranked_matches").and_then(|v| v.as_array()) {
        for m in matches {
            let m_need_id = vtext(m, "need_id");
            let m_sponsor_id = vtext(m, "sponsor_id");
            if let Some(p) = need_map.get(&format!("{}:{}", m_need_id, m_sponsor_id)) {
                ranked.push(serde_json::json!({
                    "need_id": m_need_id,
                    "sponsor_id": m_sponsor_id,
                    "match_score": m.get("match_score").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    "match_reasons": m.get("match_reasons").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                    "next_steps": m.get("next_steps").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                    "need": p.need.clone(),
                    "sponsor": p.sponsor.clone(),
                }));
            }
        }
    }

    let degraded = ai_result.get("degraded").and_then(|v| v.as_bool()).unwrap_or(false);
    let reason = ai_result.get("reason").map(|v| v.to_string());

    ranked.sort_by(|a, b| f64::partial_cmp(
        b.get("match_score").and_then(|v| v.as_f64()).unwrap_or(0.0),
        a.get("match_score").and_then(|v| v.as_f64()).unwrap_or(0.0),
    ).unwrap_or(std::cmp::Ordering::Equal));

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "ranked_matches": ranked,
        "pre_filter_summary": {
            "total_needs": total_needs,
            "total_sponsors": total_sponsors,
            "pre_filtered_pairs": pre_filtered_pairs,
            "max_pairs": max_pairs,
        },
        "degraded": degraded,
        "reason": reason,
    }))))
}

/// `GET /api/impact-match/rankings/cached` — kết quả đã tính sẵn bởi
/// auto-scheduler của ai-service (không chờ LLM, công khai).
pub async fn get_cached_rankings(
    State(pool): State<DbPool>,
    Query(q): Query<CachedRankQuery>,
) -> Result<Response, AppError> {
    let qs = if q.refresh.as_deref() == Some("true") {
        String::from("?refresh=true")
    } else {
        String::new()
    };
    let path = format!("/api/ai/auto/impact-match/rankings{}", qs);
    proxy_get_aiservice_response(path.as_str()).await
}
