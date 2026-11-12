//! Learning Community (Learning Spaces) module — `/api/learning-spots/*`:
//! địa điểm học tập (cafe, thư viện, phòng học), tìm lân cận, kiểm tra chỗ
//! trống, gợi ý AI (xếp hạng + giải thích).
//!
//! Mirrors `backend/src/modules/learning-community/learning-community.service.ts`
//! + `learning-community.controller.ts` + `learning-space-recommender.service.ts`:
//! - `GET /learning-spots/nearby` — PostGIS, `?latitude=&longitude=&radius=`.
//! - `GET /learning-spots/:id/availability` — tình trạng chỗ ngồi (tại máy,
//!   lấy giờ hiện tại).
//! - `GET /learning-spots/recommend` — xếp hạng theo khoảng cách/đánh giá/
//!   wifi/yên tĩnh/hiện đang mở/sức chứa + trọng số (mặc định, chuẩn hóa khi
//!   tổng khác 1) + giải thích AI cho các top kết quả.
//! - `POST /learning-spots/explain` — proxy giải thích AI từ ai-service.
//! - `POST /learning-spots` — JWT, tạo địa điểm mới.
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).
//! Postgres/PostGIS only.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::proxy_to_ai_service;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Map, Value};

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct SpotNearbyQuery {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub radius: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecommendSpotsQuery {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub radius: Option<f64>,
    pub has_wifi: Option<bool>,
    pub min_rating: Option<f64>,
    pub quietness_min: Option<i64>,
    pub open_now: Option<bool>,
    pub limit: Option<String>,
    pub w_distance: Option<f64>,
    pub w_rating: Option<f64>,
    pub w_wifi: Option<f64>,
    pub w_quietness: Option<f64>,
    pub w_open_now: Option<f64>,
    pub w_capacity: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSpotForm {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    #[serde(rename = "type")]
    pub resource_type: Option<String>,
    pub address: Option<String>,
    pub description: Option<String>,
    pub has_wifi: Option<bool>,
    pub has_power_outlets: Option<bool>,
    pub rating_avg: Option<f64>,
    pub total_capacity: Option<i64>,
    pub opening_hours: Option<String>,
    pub amenities: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_SPOT_BY_ID: &str = r#"
    SELECT id, name, ST_AsText(location) AS location_point, type, address,
           description, has_wifi, has_power_outlets, quietness, opening_hours,
           amenities, rating_avg, total_capacity,
           CAST(created_at AS TEXT) AS created_at,
           CAST(last_updated AS TEXT) AS last_updated
    FROM learning_spots WHERE id = $1
"#;

const DB_SELECT_SPOTS_NEARBY: &str = r#"
    SELECT id, name, ST_AsText(location) AS location_point, type, address,
           description, has_wifi, has_power_outlets, quietness, opening_hours,
           amenities, rating_avg, total_capacity,
           CAST(created_at AS TEXT) AS created_at,
           CAST(last_updated AS TEXT) AS last_updated
    FROM learning_spots
    WHERE location IS NOT NULL
      AND ST_DWithin(location,
                     ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
    ORDER BY created_at DESC
"#;

const DB_INSERT_SPOT: &str = r#"
    INSERT INTO learning_spots (name, location, type, address, description,
                                has_wifi, has_power_outlets, quietness,
                                opening_hours, amenities, rating_avg,
                                total_capacity, created_at, last_updated)
    VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, NOW(), NOW())
    RETURNING id, name, type, address, description, has_wifi, has_power_outlets,
              quietness, opening_hours, amenities, rating_avg, total_capacity,
              ST_AsText(location) AS location_point,
              CAST(created_at AS TEXT) AS created_at,
              CAST(last_updated AS TEXT) AS last_updated
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

/// Parse a PostGIS `POINT (lng, lat)` text representation into a GeoJSON
/// `Point` with `[lng, lat]` (the shape the frontend reads).
fn point_to_geojson(text: Option<&str>) -> Option<Value> {
    let text = text?;
    let text = text.trim().trim_start_matches("POINT(").trim_end_matches(')');
    let tokens: Vec<&str> = text.split(' ').filter(|t| !t.is_empty()).collect();
    if tokens.len() != 2 {
        return None;
    }
    let lng = tokens[0].parse::<f64>().ok()?;
    let lat = tokens[1].parse::<f64>().ok()?;
    Some(serde_json::json!({
        "type": "Point",
        "coordinates": [lng, lat],
    }))
}

/// Reads `{"monday":"08:00-17:00", ...}` (JSONB) into a list of
/// `(day, open, close)` where open/close are minutes since 00:00.
fn parse_opening_hours(json: Option<&str>) -> Vec<(String, i64, i64)> {
    let json = match json {
        Some(v) => v,
        None => return Vec::new(),
    };
    serde_json::from_str(json).ok().map_or(Vec::new(), |h: Map<String, String>| {
        h.into_iter()
            .map(|(day, hours)| {
                let parts: Vec<&str> = hours.split('-').collect();
                let time = |part: &str| -> i64 {
                    let p: Vec<&str> = part.split(':').collect();
                    if p.len() != 2 {
                        return 0;
                    }
                    p[0].parse::<i64>().unwrap_or(0) * 60 + p[1].parse::<i64>().unwrap_or(0)
                };
                (day, time(&parts[0]), time(parts.get(1).unwrap_or(&parts[0])))
            })
            .collect()
    })
}

/// Whether the spot is open right now (day of week of the server's clock).
fn is_open_now(opening_hours: Option<&str>) -> bool {
    let hours = parse_opening_hours(opening_hours);
    if hours.is_empty() {
        return false;
    }
    let now: DateTime<Utc> = Utc::now();
    let days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let day_name = days[now.weekday() as usize];
    match hours.iter().find(|(d, _, _)| d == day_name) {
        Some((_, open, close)) => {
            let current = now.hour() as i64 * 60 + now.minute() as i64;
            current >= open && current <= close
        }
        None => false,
    }
}

/// The `location` column of `learning_spots` (GEOGRAPHY POINT) → `[lat, lng]`
/// (PostGIS `ST_AsText` strings + GeoJSON objects).
fn to_latlng(location: Option<&Value>) -> Option<[f64; 2]> {
    let text = match location {
        Some(Value::String(s)) => s,
        Some(v) => v.as_str().or_else(|| {
            let o = v.as_object()?;
            o.get("coordinates").and_then(|c| {
                if let Some(arr) = c.as_array() {
                    if arr.len() == 2 {
                        return Some(format!(
                            "{} {}",
                            arr[0].as_str()?.to_string(),
                            arr[1].as_str()?.to_string()
                        ));
                    }
                }
                None
            })?
        })?,
        None => return None,
    };
    let text = text.trim().trim_start_matches("POINT(").trim_end_matches(')');
    let tokens: Vec<&str> = text.split(' ').filter(|t| !t.is_empty()).collect();
    if tokens.len() != 2 {
        return None;
    }
    let lng = tokens[0].parse::<f64>().ok()?;
    let lat = tokens[1].parse::<f64>().ok()?;
    Some([lat, lng])
}

fn spot_to_json(row: &impl sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "type": row.get::<Option<String>, _>("type"),
        "address": row.get::<Option<String>, _>("address"),
        "description": row.get::<Option<String>, _>("description"),
        "has_wifi": row.get::<bool>("has_wifi"),
        "has_power_outlets": row.get::<bool>("has_power_outlets"),
        "quietness": row.get::<Option<i64>, _>("quietness"),
        "opening_hours": row.get::<Option<String>, _>("opening_hours"),
        "amenities": row.get::<Option<String>, _>("amenities"),
        "rating_avg": row.get::<f64>("rating_avg"),
        "total_capacity": row.get::<i64>("total_capacity"),
        "location": point_to_geojson(row.get::<Option<String>, _>("location_point").as_deref()),
        "created_at": row.get::<Option<String>, _>("created_at"),
        "last_updated": row.get::<Option<String>, _>("last_updated"),
    })
}

// ---------------------------------------------------------------------------
// Scoring helpers (mirrored from the old recommender service)
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: [f64; 6] = [0.35, 0.20, 0.10, 0.15, 0.10, 0.10];

/// `[distance, rating, wifi, quietness, open_now, capacity]`.
struct Criterion {
    distance: f64,
    rating: f64,
    wifi: f64,
    quietness: f64,
    open_now: f64,
    capacity: f64,
}

fn criterion_label(key: &str) -> &'static str {
    match key {
        "distance" => "gần",
        "rating" => "đánh giá",
        "wifi" => "wifi",
        "quietness" => "yên tĩnh",
        "open_now" => "đang mở",
        "capacity" => "sức chứa",
        _ => key,
    }
}

/// `Math.max(0, min(1, v / scale))` — rating/quietness/capacity.
fn norm(value: Option<&Value>, scale: f64) -> f64 {
    match value {
        Some(Value::Number(n)) => (n.as_f64().unwrap_or(0.0) / scale).max(0.0).min(1.0),
        Some(Value::String(s)) => s.parse::<f64>().map(|v| (v / scale).max(0.0).min(1.0)).unwrap_or(0.0),
        _ => 0.0,
    }
}

/// Haversine in km (R = 6371 km).
fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371.0;
    let dlat = (lat2 - lat1) * std::f64::consts::PI / 180.0;
    let dlon = (lng2 - lng1) * std::f64::consts::PI / 180.0;
    let a = ((dlat / 2.0).sin()).powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * ((dlon / 2.0).sin()).powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

/// Score one spot (exactly like the old recommender service).
fn score_spot(spot: &Value, user_lat: f64, user_lng: f64, radius_km: f64) -> (Value, Criterion) {
    let weighted = [
        DEFAULT_WEIGHTS[0],
        DEFAULT_WEIGHTS[1],
        DEFAULT_WEIGHTS[2],
        DEFAULT_WEIGHTS[3],
        DEFAULT_WEIGHTS[4],
        DEFAULT_WEIGHTS[5],
    ];
    let ll = to_latlng(spot.get("location"));
    let (spot_lat, spot_lng) = match ll {
        Some(v) => v,
        None => (user_lat, user_lng),
    };
    let distance_km = if ll.is_some() {
        haversine_km(user_lat, user_lng, spot_lat, spot_lng)
    } else {
        radius_km + 1.0
    };
    let distance_norm = (1.0 - distance_km / radius_km).max(0.0);
    let rating_norm = norm(spot.get("rating_avg"), 5.0);
    let wifi_norm = match spot.get("has_wifi") {
        Some(Value::Bool(true)) => 1.0,
        _ => 0.0,
    };
    let quietness_norm = norm(spot.get("quietness"), 5.0);
    let open_norm = if is_open_now(spot.get("opening_hours").and_then(|v| v.as_str())) {
        1.0
    } else {
        0.0
    };
    let capacity_norm = norm(spot.get("total_capacity"), 500.0);

    let criteria = Criterion {
        distance: distance_norm,
        rating: rating_norm,
        wifi: wifi_norm,
        quietness: quietness_norm,
        open_now: open_norm,
        capacity: capacity_norm,
    };

    let total = weighted[0] + weighted[1] + weighted[2] + weighted[3] + weighted[4] + weighted[5];
    let _ = total;
    let score = distance_norm * weighted[0]
        + rating_norm * weighted[1]
        + wifi_norm * weighted[2]
        + quietness_norm * weighted[3]
        + open_norm * weighted[4]
        + capacity_norm * weighted[5];
    let score = (score * 100.0).round() / 100.0;

    let top = [
        (distance_norm, "distance"),
        (rating_norm, "rating"),
        (wifi_norm, "wifi"),
        (quietness_norm, "quietness"),
        (open_norm, "open_now"),
        (capacity_norm, "capacity"),
    ]
    .iter()
    .filter(|(v, _)| **v > 0.0)
    .map(|(_, k)| criterion_label(k).to_string())
    .collect::<Vec<_>>();

    (
        serde_json::json!({
            "spot": spot.clone(),
            "score": score,
            "distance_km": ((distance_km * 100.0).round() / 100.0),
            "open_now": open_norm > 0.0,
            "ranking_reason": top.join(", "),
            "matching_criteria": serde_json::json!({
                "distance": (distance_norm * 1000.0).round() / 1000.0,
                "rating": (rating_norm * 1000.0).round() / 1000.0,
                "wifi": wifi_norm,
                "quietness": (quietness_norm * 1000.0).round() / 1000.0,
                "open_now": open_norm,
                "capacity": (capacity_norm * 1000.0).round() / 1000.0,
            }),
        }),
        criteria,
    )
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các endpoint đọc là public, các handler create
/// pull JWT ra khỏi extensions và trả `401` khi JWT thiếu.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/learning-spots/nearby` — địa điểm học tập lân cận (PostGIS).
pub async fn get_nearby(
    State(pool): State<DbPool>,
    Query(q): Query<SpotNearbyQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = q.latitude.unwrap_or(10.77);
    let lng = q.longitude.unwrap_or(106.66);
    let radius = q.radius.unwrap_or(5000.0);

    let rows = sqlx::query(DB_SELECT_SPOTS_NEARBY)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let spots: Vec<Value> = rows.iter().map(|r| spot_to_json(&r)).collect();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": spots,
        "center": {
            "lat": lat,
            "lng": lng,
        },
        "radius_m": radius,
    }))))
}

/// `GET /api/learning-spots/:id/availability` — tình trạng chỗ ngồi theo giờ
/// hiện tại (tính tại máy, giống old backend).
pub async fn get_availability(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_SPOT_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(r) => {
            let total_capacity: i64 = r.get("total_capacity");
            let now: DateTime<Utc> = Utc::now();
            let current_hour = now.hour() as i64;
            let occupancy_rate = if current_hour >= 8 && current_hour <= 11 {
                0.75
            } else if current_hour >= 14 && current_hour <= 17 {
                0.85
            } else if current_hour >= 19 && current_hour <= 22 {
                0.95
            } else if current_hour >= 23 || current_hour <= 6 {
                0.05
            } else {
                0.30
            };
            let current_occupancy = (total_capacity as f64 * occupancy_rate).floor() as i64;
            let available_seats = (total_capacity - current_occupancy).max(0);
            let status = if available_seats == 0 {
                "full"
            } else if available_seats <= 5 {
                "almost_full"
            } else {
                "available"
            };
            Ok(Json(ApiResponse::ok(serde_json::json!({
                "spot_id": r.get::<String>("id"),
                "spot_name": r.get::<String>("name"),
                "total_capacity": total_capacity,
                "current_occupancy": current_occupancy,
                "available_seats": available_seats,
                "status": status,
                "last_updated": now.to_rfc3339(),
            }))))
        }
        None => Err(AppError::NotFound(
            "Địa điểm học tập không tồn tại.".to_string(),
        )),
    }
}

/// `GET /api/learning-spots/recommend` — gợi ý địa điểm học tập theo vị trí +
/// tiêu chí, xếp hạng (trọng số mặc định, chuẩn hóa khi tổng khác 1), sau đó
/// proxy giải thích AI cho các top kết quả (lỗi từng chỗ không làm lỗi cả
/// request).
pub async fn recommend_spots(
    State(pool): State<DbPool>,
    Query(q): Query<RecommendSpotsQuery>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let lat = q.lat.unwrap_or(10.77);
    let lng = q.lng.unwrap_or(106.66);
    let radius_m = q.radius.unwrap_or(5000.0);
    let radius_km = radius_m / 1000.0;
    let limit = q.limit.unwrap_or("20").parse::<i64>().unwrap_or(20).max(1).min(100);

    // Trọng số: mặc định + override (chuẩn hóa khi tổng khác 1).
    let mut w: Vec<(String, f64)> = vec![
        ("distance".into(), DEFAULT_WEIGHTS[0]),
        ("rating".into(), DEFAULT_WEIGHTS[1]),
        ("wifi".into(), DEFAULT_WEIGHTS[2]),
        ("quietness".into(), DEFAULT_WEIGHTS[3]),
        ("open_now".into(), DEFAULT_WEIGHTS[4]),
        ("capacity".into(), DEFAULT_WEIGHTS[5]),
    ];
    for (key, value) in [
        ("w_distance", q.w_distance),
        ("w_rating", q.w_rating),
        ("w_wifi", q.w_wifi),
        ("w_quietness", q.w_quietness),
        ("w_open_now", q.w_open_now),
        ("w_capacity", q.w_capacity),
    ] {
        if let Some(v) = value {
            w.retain(|(k, _)| k != key);
            w.push((key.to_string(), v));
        }
    }
    let total = w.iter().map(|(_, v)| *v).sum::<f64>();
    if total > 0.0 && total != 1.0 {
        let f = 1.0 / total;
        for (_, v) in w.iter_mut() {
            *v = (*v * f * 1000.0).round() / 1000.0;
        }
    }

    // Tất cả các địa điểm trong bán kính.
    let rows = sqlx::query(DB_SELECT_SPOTS_NEARBY)
        .bind(&lng)
        .bind(&lat)
        .bind(&radius_m)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let mut scored: Vec<Value> = Vec::new();
    for r in &rows {
        let s = spot_to_json(&r);
        if to_latlng(s.get("location")).is_none() {
            continue;
        }
        let (spot_lat, spot_lng) = to_latlng(s.get("location")).unwrap();
        let dist_m = haversine_km(lat, lng, spot_lat, spot_lng) * 1000.0;
        if dist_m > radius_m {
            continue;
        }
        if q.has_wifi.unwrap_or(false) && !Boolean(s.get("has_wifi")) {
            continue;
        }
        if let Some(min_rating) = q.min_rating {
            if norm(s.get("rating_avg"), 5.0) < min_rating {
                continue;
            }
        }
        if let Some(quietness_min) = q.quietness_min {
            if quietness_min > 0 && norm(s.get("quietness"), 5.0) < (quietness_min as f64 / 5.0) {
                continue;
            }
        }
        if q.open_now.unwrap_or(false)
            && !is_open_now(s.get("opening_hours").and_then(|v| v.as_str()))
        {
            continue;
        }
        let (entry, _) = score_spot(&s, lat, lng, radius_km);
        scored.push(entry);
    }
    scored.sort_by(|a, b| {
        let sa = a.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let sb = b.get("score").and_then(|v| v.as_f64()).unwrap_or(0.0);
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Proxy giải thích AI cho các top kết quả (giống old backend: từng chỗ —
    // lỗi của chỗ nào, degrade chỗ đó, không giết cả request).
    let mut degraded = false;
    let mut reason: Option<String> = None;
    let total = scored.len();
    for entry in scored.iter_mut().take(limit as usize) {
        let spot = entry.get("spot").unwrap_or(&Value::Null).clone();
        let dist = entry.get("distance_km").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let body = serde_json::json!({
            "spot": {
                "id": spot.get("id"),
                "name": spot.get("name"),
                "type": spot.get("type"),
                "address": spot.get("address"),
                "rating_avg": spot.get("rating_avg"),
                "quietness": spot.get("quietness"),
                "amenities": spot.get("amenities"),
                "opening_hours": spot.get("opening_hours"),
                "has_wifi": spot.get("has_wifi"),
                "distance_km": dist,
            },
            "preferences": {
                "radius_km": radius_km,
            },
        });
        match proxy_to_ai_service("/api/ai/learning-space/explain", body).await {
            Ok(resp) => {
                if let Some(explanation) = resp.get("explanation").and_then(|v| v.as_str()) {
                    entry["explanation"] = serde_json::json!(explanation);
                }
                if resp.get("degraded").and_then(|v| v.as_bool()).unwrap_or(false)
                    || resp.get("reason").is_some()
                {
                    degraded = true;
                    if let Some(r) = resp.get("reason").and_then(|v| v.as_str()) {
                        reason = Some(r.to_string());
                    }
                }
            }
            Err(_) => {
                degraded = true;
                reason = Some("AI giải thích không khả dụng — hiển thị lý do xếp hạng tĩnh.".to_string());
            }
        }
    }

    let spots: Vec<Value> = scored
        .into_iter()
        .take(limit as usize)
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "spots": spots,
        "total": total,
        "center": {
            "lat": lat,
            "lng": lng,
        },
        "radius_km": radius_km,
        "degraded": degraded,
        "reason": reason,
    }))))
}

/// `POST /api/learning-spots/explain` — proxy bộ giải thích AI của
/// ai-service (`POST /api/ai/learning-space/explain`).
pub async fn explain_spot(
    State(pool): State<DbPool>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _pool = pool; // reserved (no DB read needed for the proxy path).
    let result = proxy_to_ai_service("/api/ai/learning-space/explain", body).await?;
    Ok(Json(ApiResponse::ok(result)))
}

/// `POST /api/learning-spots` — đăng ký địa điểm học tập (cafe, thư viện,
/// phòng học...) — JWT.
pub async fn create_spot(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateSpotForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if form.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Tên địa điểm là bắt buộc.".to_string(),
        ));
    }

    let row = sqlx::query(DB_INSERT_SPOT)
        .bind(&form.name)
        .bind(&form.longitude)
        .bind(&form.latitude)
        .bind(form.resource_type.as_deref())
        .bind(form.address.as_deref())
        .bind(form.description.as_deref())
        .bind(form.has_wifi.unwrap_or(true))
        .bind(form.has_power_outlets.unwrap_or(true))
        .bind(None::<i64>)
        .bind(form.opening_hours.as_deref())
        .bind(form.amenities.as_deref())
        .bind(form.rating_avg)
        .bind(form.total_capacity.as_deref().and_then(|v| v.trim().parse::<i64>().ok()).unwrap_or(50))
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let _ = user.id;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "spot": spot_to_json(&row),
    }))))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn Boolean(v: Option<&Value>) -> bool {
    match v {
        Some(Value::Bool(b)) => *b,
        _ => false,
    }
}
