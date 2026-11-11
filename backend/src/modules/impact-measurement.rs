//! Impact Measurement AI (Idea #19) — `/api/impact-measurement/*`: báo cáo
//! tác động đo lường AI (trước/sau triển khai, người trong bán kính, xu hướng,
//! khoảng tin cậy, điểm tác động, suy luận nhân quả và lời kể).
//!
//! Mirrors `backend/src/modules/impact-measurement/impact-measurement.controller.ts` +
//! `impact-measurement.service.ts`:
//! - `GET /api/impact-measurement/metrics` proxy `GET /api/ai/impact/metrics`
//!   của ai-service (population, before/after access rate, impact score,
//!   coverage improvement).
//! - `GET /api/impact-measurement/measure` proxy `POST /api/ai/impact/measure`
//!   của ai-service (full AI impact report).
//! - `GET /api/impact-measurement/auto-cached/:regionId` proxy
//!   `GET /api/ai/auto/impact-measurement/{regionId}` (kết quả auto-scheduler).
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).
//! Postgres/PostGIS only.

use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::{proxy_get_aiservice, proxy_to_ai_service};
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ImpactQuery {
    pub min_lat: Option<f64>,
    pub max_lat: Option<f64>,
    pub min_lng: Option<f64>,
    pub max_lng: Option<f64>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub deployment_date: Option<String>,
    pub region: Option<String>,
    pub facility_types: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build the query string of a `GET` proxy (e.g. `?minLat=10.9&maxLat=11.0`).
fn query_string(params: &ImpactQuery) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(v) = params.min_lat {
        parts.push(format!("minLat={}", v));
    }
    if let Some(v) = params.max_lat {
        parts.push(format!("maxLat={}", v));
    }
    if let Some(v) = params.min_lng {
        parts.push(format!("minLng={}", v));
    }
    if let Some(v) = params.max_lng {
        parts.push(format!("maxLng={}", v));
    }
    if let Some(v) = params.lat {
        parts.push(format!("lat={}", v));
    }
    if let Some(v) = params.lng {
        parts.push(format!("lng={}", v));
    }
    if let Some(v) = params.radius_km {
        parts.push(format!("radiusKm={}", v));
    }
    if let Some(v) = &params.deployment_date {
        parts.push(format!("deploymentDate={}", v));
    }
    if let Some(v) = &params.region {
        parts.push(format!("region={}", v));
    }
    if let Some(v) = &params.facility_types {
        parts.push(format!("facilityTypes={}", v));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!("?{}", parts.join("&"))
    }
}

/// Build the JSON body of a `POST` proxy into the ai-service `ImpactMeasureRequest`.
fn proxy_body(params: &ImpactQuery) -> Value {
    let facility_types: Option<Vec<String>> = params.facility_types
        .as_ref()
        .filter(|t| !t.trim().is_empty())
        .map(|t| t.split(',').map(|t| t.trim().to_string()).collect::<Vec<_>>());

    serde_json::json!({
        "min_lat": params.min_lat,
        "max_lat": params.max_lat,
        "min_lng": params.min_lng,
        "max_lng": params.max_lng,
        "lat": params.lat,
        "lng": params.lng,
        "radius_km": params.radius_km.unwrap_or(15.0),
        "deployment_date": params.deployment_date,
        "region": params.region,
        "facility_types": facility_types,
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/impact-measurement/metrics` — bản tin tác động nhẹ (proxy `GET
/// /api/ai/impact/metrics` của ai-service).
pub async fn get_metrics(
    State(pool): State<DbPool>,
    Query(q): Query<ImpactQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let path = format!("/api/ai/impact/metrics{}", query_string(&q));
    let metrics = proxy_get_aiservice(path.as_str()).await?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "metrics": metrics,
    }))))
}

/// `GET /api/impact-measurement/measure` — báo cáo AI tác động đầy đủ. Các
/// tham số đến từ query, body JSON được POST vào `/api/ai/impact/measure`.
pub async fn measure(
    State(pool): State<DbPool>,
    Query(q): Query<ImpactQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let body = proxy_body(&q);
    let result = proxy_to_ai_service("/api/ai/impact/measure", body).await?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "report": result,
    }))))
}

/// `GET /api/impact-measurement/auto-cached/:regionId` — báo cáo auto-scheduler
/// (dữ liệu đã tính sẵn, không chờ LLM).
pub async fn get_auto_cached_measure(
    State(pool): State<DbPool>,
    Path(region_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let path = format!("/api/ai/auto/impact-measurement/{}", region_id);
    let result = proxy_get_aiservice(path.as_str()).await?;
    let degraded = result.get("status").and_then(|v| v.as_str()).map(|v| v == "warming").unwrap_or(false);
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "region_id": region_id,
        "data": result,
        "degraded": degraded,
    }))))
}
