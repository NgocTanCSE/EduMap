//! Opportunity module — `/api/opportunities/*`: cơ hội (thực tập, học bổng,
//! cuộc thi) trên bản đồ, đăng tải, tìm đồng đội và Opportunity Radar (ghép
//! hồ sơ người dùng ↔ cơ hội qua AI).
//!
//! Mirrors `backend/src/modules/opportunity/opportunity.controller.ts`,
//! `opportunity.service.ts` + `opportunity-matching.service.ts`. Endpoint đọc
//! là public; `POST`, `team-finding` và `match` tự kiểm JWT.

use crate::common::auth::authenticated_user;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct OpportunitiesQuery {
    pub type_: Option<String>,
    pub field: Option<String>,
    pub bounds: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpportunityBody {
    pub title: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address: Option<String>,
    pub deadline: Option<String>,
    pub is_team_finding_open: Option<bool>,
    pub tags: Option<Value>,
    pub organization: Option<String>,
    pub requirements: Option<String>,
    pub benefits: Option<String>,
    pub url: Option<String>,
    pub region: Option<String>,
    pub field_tags: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MatchQuery {
    pub type_: Option<String>,
    pub field: Option<String>,
    pub limit: Option<i64>,
    pub gpa: Option<f64>,
}

#[derive(Debug, Clone)]
struct UserProfile {
    id: String,
    full_name: String,
    major: String,
    skills: Vec<String>,
    interests: Vec<String>,
    location: String,
    role: String,
    gpa: Option<f64>,
}

#[derive(Debug, Clone)]
struct NormalizedOpportunity {
    id: String,
    title: String,
    description: String,
    type_: String,
    organization: String,
    requirements: String,
    benefits: String,
    url: String,
    field_tags: Vec<String>,
    region: String,
    deadline: Option<String>,
    source_table: String,
    status: String,
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_OPPORTUNITIES: &str = r#"
SELECT id, title, description, type, organization,
       CAST(location_point AS TEXT) AS location_point, address,
       CAST(deadline AS TEXT) AS deadline, requirements, benefits, url,
       CAST(field_tags AS TEXT) AS field_tags, region, status,
       CAST(created_by AS TEXT) AS created_by, is_team_finding_open,
       CAST(tags AS TEXT) AS tags,
       CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
FROM opportunities
WHERE deleted_at IS NULL
  AND (status = 'active' OR status IS NULL)
"#;

const DB_SELECT_OPPORTUNITY: &str = r#"
SELECT id, title, description, type, organization,
       CAST(location_point AS TEXT) AS location_point, address,
       CAST(deadline AS TEXT) AS deadline, requirements, benefits, url,
       CAST(field_tags AS TEXT) AS field_tags, region, status,
       CAST(created_by AS TEXT) AS created_by, is_team_finding_open,
       CAST(tags AS TEXT) AS tags,
       CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
FROM opportunities WHERE id = $1 AND deleted_at IS NULL
"#;

const DB_INSERT_OPPORTUNITY: &str = r#"
INSERT INTO opportunities (title, type, description, organization, location_point,
    address, deadline, requirements, benefits, url, field_tags, region, status,
    created_by, is_team_finding_open, tags, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    NOW(), NOW())
RETURNING id
"#;

const DB_TOGGLE_TEAM_FINDING: &str = r#"
UPDATE opportunities SET is_team_finding_open = NOT is_team_finding_open,
    updated_at = NOW()
WHERE id = $1 AND created_by = $2::UUID AND deleted_at IS NULL
RETURNING id, is_team_finding_open
"#;

const DB_SCHOLARSHIPS: &str = r#"
SELECT id, title, description, provider,
       CAST(location AS TEXT) AS location,
       CAST(deadline AS TEXT) AS deadline,
       CAST(eligibility_criteria AS TEXT) AS eligibility_criteria,
       apply_url, status,
       CAST(created_at AS TEXT) AS created_at
FROM scholarships WHERE deleted_at IS NULL AND status = 'active'
"#;

const DB_JOBS: &str = r#"
SELECT id, title, description, company_name, location, job_type, salary_range,
       CAST(required_skills AS TEXT) AS required_skills, experience_level,
       CAST(application_deadline AS TEXT) AS application_deadline, status,
       CAST(created_at AS TEXT) AS created_at
FROM jobs WHERE status = 'active'
"#;

const DB_USER_PROFILE: &str = r#"
SELECT id, full_name, major,
       CAST(skills AS TEXT) AS skills,
       CAST(interests AS TEXT) AS interests,
       CAST(location AS TEXT) AS location, role
FROM users WHERE id = $1
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_json_array(v: &Value) -> Vec<String> {
    v.as_array().map(|a| {
        a.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect()
    }).unwrap_or_default()
}

fn parse_geojson_point(text: &str) -> Option<(f64, f64)> {
    let v: Value = serde_json::from_str(text).ok()?;
    let coords = v.get("coordinates").and_then(|c| c.as_array())?;
    if coords.len() < 2 {
        return None;
    }
    Some((coords[0].as_f64()?, coords[1].as_f64()?))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn escape_like(value: &str) -> String {
    value.replace('\\', "\\\\").replace('%', "\\%").replace("_", "\\_")
}

fn build_opportunity_sql(filters: &[String]) -> String {
    let mut sql = DB_SELECT_OPPORTUNITIES.to_string();
    if !filters.is_empty() {
        sql = sql.replace("WHERE deleted_at IS NULL", &format!("WHERE deleted_at IS NULL AND {}", filters.join(" AND ")));
    }
    sql
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/opportunities?type=&field=&bounds=` — danh sách cơ hội.
pub async fn get_opportunities(
    State(pool): State<DbPool>,
    Query(q): Query<OpportunitiesQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let filters: Vec<String> = vec![
        q.type_.as_ref().filter(|v| !v.is_empty()).map(|t| format!("type = '{}'", escape_like(t))),
        q.field.as_ref().filter(|v| !v.is_empty()).map(|f| {
            let kw = format!("%{}%", escape_like(f));
            format!(
                "(title ILIKE '{}' OR description ILIKE '{}')",
                kw.replace('\'', "''"),
                kw.replace('\'', "''")
            )
        }),
        q.bounds.as_ref().filter(|v| !v.is_empty()).map(|b| {
            let parts: Vec<&str> = b.split(',').collect();
            if parts.len() == 4 {
                format!(
                    "location_point && ST_MakeEnvelope({}, {}, {}, {}, 4326)",
                    parts[0], parts[1], parts[2], parts[3]
                )
            } else {
                "FALSE".to_string()
            }
        }),
    ]
    .into_iter()
    .filter(Option::is_some)
    .map(Option::unwrap)
    .collect();

    let rows = sqlx::query(&build_opportunity_sql(&filters))
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read opportunities: {e}")))?;

    let items: Vec<Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String>("id"),
            "title": row.get::<Option<String>>("title"),
            "description": row.get::<Option<String>>("description"),
            "type": row.get::<Option<String>>("type"),
            "organization": row.get::<Option<String>>("organization"),
            "address": row.get::<Option<String>>("address"),
            "deadline": row.get::<Option<String>>("deadline"),
            "requirements": row.get::<Option<String>>("requirements"),
            "benefits": row.get::<Option<String>>("benefits"),
            "url": row.get::<Option<String>>("url"),
            "region": row.get::<Option<String>>("region"),
            "status": row.get::<Option<String>>("status"),
            "isTeamFindingOpen": row.get::<Option<bool>>("is_team_finding_open"),
            "createdAt": row.get::<Option<String>>("created_at"),
        })
    }).collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({ "items": items, "total": items.len() as i64 }))))
}

/// `POST /api/opportunities` — đăng tải cơ hội mới.
pub async fn create_opportunity(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<OpportunityBody>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let title = body.title.as_deref().ok_or_else(|| AppError::BadRequest("title is required".to_string()))?;

    let location_point = match (body.latitude, body.longitude) {
        (Some(lat), Some(lng)) => format!("ST_SetSRID(ST_MakePoint({lng:.6}, {lat:.6}), 4326)"),
        _ => "NULL".to_string(),
    };

    let row = sqlx::query(&format!(
        r#"
INSERT INTO opportunities (title, type, description, organization, location_point,
    address, deadline, requirements, benefits, url, field_tags, region, status,
    created_by, is_team_finding_open, tags, created_at, updated_at)
VALUES ($1, $2, $3, $4, {location_point}, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, NOW(), NOW())
RETURNING id
"#,
    ))
        .bind(title)
        .bind(body.category.as_deref().unwrap_or("opportunity"))
        .bind(body.description.as_deref().unwrap_or(""))
        .bind(body.organization.as_deref().unwrap_or(""))
        .bind(body.address.as_deref().unwrap_or(""))
        .bind(body.deadline.as_deref())
        .bind(body.requirements.as_deref().unwrap_or(""))
        .bind(body.benefits.as_deref().unwrap_or(""))
        .bind(body.url.as_deref().unwrap_or(""))
        .bind(body.field_tags.as_ref().map(|t| t.to_string()).unwrap_or_default())
        .bind(body.region.as_deref().unwrap_or(""))
        .bind("open")
        .bind(user.id.as_str())
        .bind(body.is_team_finding_open.unwrap_or(false))
        .bind(body.tags.as_ref().map(|t| t.to_string()).unwrap_or_default())
        .fetch_one(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to create opportunity: {e}")))?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "id": row.get::<String>("id") }))))
}

/// `GET /api/opportunities/:id` — chi tiết một cơ hội.
pub async fn find_one(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_OPPORTUNITY)
        .bind(id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read opportunity: {e}")))?;

    let row = match row {
        Some(r) => r,
        None => return Err(AppError::NotFound("Không tìm thấy cơ hội được yêu cầu".to_string())),
    };

    let result = serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title"),
        "description": row.get::<Option<String>>("description"),
        "type": row.get::<Option<String>>("type"),
        "organization": row.get::<Option<String>>("organization"),
        "address": row.get::<Option<String>>("address"),
        "deadline": row.get::<Option<String>>("deadline"),
        "requirements": row.get::<Option<String>>("requirements"),
        "benefits": row.get::<Option<String>>("benefits"),
        "url": row.get::<Option<String>>("url"),
        "region": row.get::<Option<String>>("region"),
        "status": row.get::<Option<String>>("status"),
        "isTeamFindingOpen": row.get::<Option<bool>>("is_team_finding_open"),
        "createdAt": row.get::<Option<String>>("created_at"),
    });
    Ok(Json(ApiResponse::ok(result)))
}

/// `POST /api/opportunities/:id/team-finding` — bật/tắt tìm đồng đội.
/// Chỉ người tạo mới được thay đổi (kiểm `created_by`).
pub async fn toggle_team_finding(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_TOGGLE_TEAM_FINDING)
        .bind(id.as_str())
        .bind(user.id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to update opportunity: {e}")))?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "id": r.get::<String>("id"),
            "isTeamFindingOpen": r.get::<bool>("is_team_finding_open"),
            "message": if r.get::<bool>("is_team_finding_open") {
                "Đã bật tìm đồng đội cho cơ hội này."
            } else {
                "Đã tắt tìm đồng đội cho cơ hội này."
            },
        })))),
        None => Err(AppError::Forbidden("Bạn không phải là người tạo cơ hội này.".to_string())),
    }
}

/// `POST /api/opportunities/match` — Opportunity Radar: tiền lọc cơ hội (jobs,
// scholarships, opportunities) sau đó xếp hạng qua ai-service. Khi ai-service
// unavailable, tự xếp hạng theo từ khoá (keyword fallback).
pub async fn match_opportunities(
    State(pool): State<DbPool>,
    req: Request,
    Json(query): Json<MatchQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let user_row = sqlx::query(DB_USER_PROFILE)
        .bind(user.id.as_str())
        .fetch_optional(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read user profile: {e}")))?;

    let profile = match user_row {
        Some(r) => UserProfile {
            id: r.get::<String>("id"),
            full_name: r.get::<Option<String>>("full_name").unwrap_or_default(),
            major: r.get::<Option<String>>("major").unwrap_or_default(),
            skills: r.get::<Option<String>>("skills").map(|s| parse_json_array(&serde_json::from_str(&s).unwrap_or_default())).unwrap_or_default(),
            interests: r.get::<Option<String>>("interests").map(|s| parse_json_array(&serde_json::from_str(&s).unwrap_or_default())).unwrap_or_default(),
            location: r.get::<Option<String>>("location").unwrap_or_default(),
            role: r.get::<String>("role"),
            gpa: query.gpa,
        },
        None => return Err(AppError::NotFound("Người dùng không tồn tại".to_string())),
    };

    let limit = std::cmp::min(query.limit.unwrap_or(30), 60);
    let field = query.type_.as_ref().map(|s| s.trim());
    let has_field = field.map(|f| !f.is_empty()).unwrap_or(false);
    let type_filter = query.type_.as_ref().map(|s| s.trim());
    let has_type = type_filter.map(|t| !t.is_empty()).unwrap_or(false);

    // opportunities
    let mut opp_filters = vec!["deleted_at IS NULL".to_string(), "(status = 'active' OR status IS NULL)".to_string()];
    opp_filters.push("(deadline IS NULL OR deadline > NOW())".to_string());
    if has_type {
        opp_filters.push(format!("type = '{}'", escape_like(type_filter.unwrap())));
    }
    if has_field {
        let kw = format!("%{}%", escape_like(field.unwrap()));
        opp_filters.push(format!(
            "(title ILIKE '{}' OR description ILIKE '{}')",
            kw.replace('\'', "''"),
            kw.replace('\'', "''")
        ));
    }
    let opp_rows = sqlx::query(&format!(
        "SELECT id, title, description, type, organization, requirements, benefits, url,
                CAST(field_tags AS TEXT) AS field_tags, region, status, deadline
         FROM opportunities WHERE {}",
        opp_filters.join(" AND ")
    ))
        .limit(limit)
        .fetch_all(pool.db())
        .await
        .map_err(|e| AppError::Internal(format!("failed to read opportunities: {e}")))?;

    let scholarships_rows = sqlx::query(DB_SCHOLARSHIPS).limit(limit).fetch_all(pool.db())
        .await.map_err(|e| AppError::Internal(format!("failed to read scholarships: {e}")))?;
    let jobs_rows = sqlx::query(DB_JOBS).limit(limit).fetch_all(pool.db())
        .await.map_err(|e| AppError::Internal(format!("failed to read jobs: {e}")))?;

    let mut candidates: Vec<NormalizedOpportunity> = Vec::new();
    for row in opp_rows {
        candidates.push(NormalizedOpportunity {
            id: row.get::<String>("id"),
            title: row.get::<Option<String>>("title").unwrap_or_default(),
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            type_: row.get::<Option<String>>("type").unwrap_or_default(),
            organization: row.get::<Option<String>>("organization").unwrap_or_default(),
            requirements: row.get::<Option<String>>("requirements").unwrap_or_default(),
            benefits: row.get::<Option<String>>("benefits").unwrap_or_default(),
            url: row.get::<Option<String>>("url").unwrap_or_default(),
            field_tags: row.get::<Option<String>>("field_tags").map(|s| parse_json_array(&serde_json::from_str(&s).unwrap_or_default())).unwrap_or_default(),
            region: row.get::<Option<String>>("region").unwrap_or_default(),
            deadline: row.get::<Option<String>>("deadline"),
            source_table: "opportunities".to_string(),
            status: row.get::<Option<String>>("status").unwrap_or_default(),
        });
    }
    for row in scholarships_rows {
        candidates.push(NormalizedOpportunity {
            id: row.get::<String>("id"),
            title: row.get::<Option<String>>("title").unwrap_or_default(),
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            type_: "scholarship".to_string(),
            organization: row.get::<Option<String>>("provider").unwrap_or_default(),
            requirements: row.get::<Option<String>>("eligibility_criteria").unwrap_or_default(),
            benefits: row.get::<Option<String>>("apply_url").map(|u| format!("Áp dụng tại: {u}")).unwrap_or_default(),
            url: row.get::<Option<String>>("apply_url").unwrap_or_default(),
            field_tags: Vec::new(),
            region: "".to_string(),
            deadline: row.get::<Option<String>>("deadline"),
            source_table: "scholarships".to_string(),
            status: row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        });
    }
    for row in jobs_rows {
        let skills = row.get::<Option<String>>("required_skills").map(|s| parse_json_array(&serde_json::from_str(&s).unwrap_or_default())).unwrap_or_default();
        candidates.push(NormalizedOpportunity {
            id: row.get::<String>("id"),
            title: row.get::<Option<String>>("title").unwrap_or_default(),
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            type_: row.get::<Option<String>>("job_type").unwrap_or_default(),
            organization: row.get::<Option<String>>("company_name").unwrap_or_default(),
            requirements: {
                let mut r = skills.clone();
                if let Some(e) = row.get::<Option<String>>("experience_level") { r.push(e) };
                r.join("; ")
            },
            benefits: row.get::<Option<String>>("salary_range").unwrap_or_default(),
            url: "".to_string(),
            field_tags: skills,
            region: row.get::<Option<String>>("location").unwrap_or_default(),
            deadline: row.get::<Option<String>>("application_deadline"),
            source_table: "jobs".to_string(),
            status: row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        });
    }

    // filter by type / deadline
    let now = chrono::Utc::now();
    if has_type {
        let t = type_filter.unwrap().to_lowercase();
        candidates.retain(|c| {
            c.type_.to_lowercase() == t || c.source_table == t
        });
    }
    candidates.retain(|c| {
        c.deadline.as_ref().map_or(true, |d| {
            chrono::DateTime::parse_from_rfc3339(d).map(|dt| dt.to_utc() > now).unwrap_or(false)
        })
    });

    tracing::info!("[OpportunityRadar] pre-filtered {} candidates for user {}", candidates.len(), user.id);

    let payload = serde_json::json!({
        "user_profile": {
            "id": profile.id, "full_name": profile.full_name, "major": profile.major,
            "skills": profile.skills, "interests": profile.interests,
            "location": profile.location, "role": profile.role, "gpa": profile.gpa,
        },
        "opportunities": candidates.iter().map(|c| {
            serde_json::json!({
                "id": c.id, "title": c.title, "description": c.description,
                "type": c.type_, "organization": c.organization,
                "requirements": c.requirements, "benefits": c.benefits,
                "url": c.url, "field_tags": c.field_tags, "region": c.region,
                "deadline": c.deadline, "source_table": c.source_table,
                "status": c.status,
            })
        }).collect::<Vec<_>>(),
    });

    match proxy_to_ai_service("/api/ai/opportunity/match", payload).await {
        Ok(ai_result) => Ok(Json(ApiResponse::ok(ai_result))),
        Err(e) => {
            tracing::warn!("opportunity/match ai-service unavailable: {e}; keyword fallback");
            Ok(Json(ApiResponse::ok(keyword_fallback(&profile, &candidates, &e))))
        }
    }
}

/// Fallback xếp hạng theo từ khoá (giống `_keywordFallback` cũ) — chạy khi
// ai-service không phản hồi, để endpoint luôn trả về thay vì 502.
fn keyword_fallback(profile: &UserProfile, candidates: &[NormalizedOpportunity], error: &str) -> Value {
    let profile_terms: Vec<String> = vec![profile.major.clone()]
        .into_iter()
        .chain(profile.skills.clone())
        .chain(profile.interests.clone())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_lowercase())
        .collect();
    let region = profile.location.to_lowercase();
    let now = chrono::Utc::now();

    let mut scored: Vec<(NormalizedOpportunity, i64, Vec<String>)> = Vec::new();
    for c in candidates {
        if let Some(d) = c.deadline.as_ref() {
            if chrono::DateTime::parse_from_rfc3339(d).map(|dt| dt.to_utc() <= now).unwrap_or(false) {
                continue;
            }
        }
        let text = format!(
            "{} {} {} {} {}",
            c.title, c.description, c.requirements,
            c.field_tags.join(" "), c.organization
        )
        .to_lowercase();
        let mut score = 0_i64;
        let mut reasons: Vec<String> = Vec::new();
        for term in &profile_terms {
            if text.contains(term) {
                score += 12;
                if reasons.len() < 4 {
                    reasons.push(format!("Khớp: {term}"));
                }
            }
        }
        if !region.is_empty() && (c.region.to_lowercase().contains(&region) || text.contains(&region)) {
            score += 15;
            if reasons.len() < 4 {
                reasons.push("Khu vực phù hợp".to_string());
            }
        }
        scored.push((c.clone(), score, reasons));
    }
    scored.sort_by(|a, b| b.1.cmp(&a.1));

    let matches: Vec<Value> = scored.into_iter().take(15).map(|(c, score, reasons)| {
        serde_json::json!({
            "id": c.id, "title": c.title, "description": c.description,
            "type": c.type_, "organization": c.organization,
            "url": c.url, "region": c.region, "deadline": c.deadline,
            "sourceTable": c.source_table, "score": score, "reasons": reasons,
        })
    }).collect();

    serde_json::json!({
        "matches": matches,
        "total": matches.len() as i64,
        "degraded": true,
        "reason": format!("AI matching unavailable: {error}"),
        "user_profile": {
            "major": profile.major, "skills": profile.skills,
            "interests": profile.interests, "location": profile.location,
        },
    })
}