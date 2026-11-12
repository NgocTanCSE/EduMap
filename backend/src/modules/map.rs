//! Map module — `/map/*` and `/map/routing/*` endpoints: POIs, locations,
//! categories, stats, routing, climate, data gaps, survey planning,
//! resource optimisation, NL search.
//!
//! All SQL uses the runtime API (`query!` requires a live DB at compile time).
//! PostGIS `ST_Intersects`/`ST_DWithin` are used directly (DB = Postgres
//! + PostGIS).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::proxy::{proxy_get_routing, proxy_to_ai_service};
use axum::extract::{Path, Query, State};
use axum::http::Request;
use axum::Json;
use serde::{Deserialize, Serialize};
use tracing::error;

/// The client must be logged in to write (`@UseGuards(JwtAuthGuard)` in the
/// old backend). `/map` is a public route so the `AuthLayer` doesn't insert
/// an `AuthUser`: the handlers check it themselves and answer 401.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

const DB_SELECT_POIS_BY_BBOX: &str = r#"
    SELECT id, name, description, type_id, address, city,
           ST_AsText(location) AS location, status, verified,
           CAST(rating_avg AS DOUBLE PRECISION) AS rating_avg, rating_count, created_at
    FROM map_points
    WHERE ST_Intersects(location, ST_MakeEnvelope($1, $2, $3, $4, 4326))
    AND deleted_at IS NULL
    LIMIT 5000
"#;

const DB_SELECT_POIS_BY_TYPE_ID: &str = r#"
    SELECT id, name, description, type_id, address, city,
           ST_AsText(location) AS location, status, verified,
           CAST(rating_avg AS DOUBLE PRECISION) AS rating_avg, rating_count, created_at
    FROM map_points
    WHERE (type_id = $1
           OR LOWER(description) LIKE $2
           OR LOWER(description) LIKE $3)
    AND deleted_at IS NULL
    LIMIT 5000
"#;

const DB_SELECT_LOCATIONS_BY_BBOX: &str = r#"
    SELECT l.id, l.name, l.description, l.category_id, c.name AS category_name,
           l.address, l.city, CAST(l.rating_avg AS DOUBLE PRECISION) AS rating_avg,
           l.rating_count, l.status, l.is_verified, l.coordinates,
           l.created_at
    FROM locations l
    LEFT JOIN location_categories c ON c.id = l.category_id
    WHERE ST_Intersects(l.coordinates, ST_MakeEnvelope($1, $2, $3, $4, 4326))
    LIMIT 5000
"#;

const DB_SELECT_LOCATION_BY_ID: &str = r#"
    SELECT id, name, description, category_id, address, city,
           CAST(rating_avg AS DOUBLE PRECISION) AS rating_avg, rating_count, status, is_verified,
           ST_AsText(coordinates) AS coordinates, created_at
    FROM locations
    WHERE id = $1
"#;

const DB_SELECT_POI_BY_ID: &str = r#"
    SELECT id, name, description, type_id, address, city, ST_AsText(location) AS location,
           status, verified, CAST(rating_avg AS DOUBLE PRECISION) AS rating_avg, rating_count, created_at
    FROM map_points
    WHERE id = $1 AND deleted_at IS NULL
"#;

const DB_SELECT_NEARBY_POIS: &str = r#"
    SELECT id, name, description, type_id, address, city, ST_AsText(location) AS location,
           status, verified, CAST(rating_avg AS DOUBLE PRECISION) AS rating_avg, rating_count, created_at
    FROM map_points
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
    ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 20
"#;

const DB_SELECT_STEM_LABS: &str = r#"
    SELECT id, name, ST_AsText(location_point) AS location_point,
           location_point_text AS location_point_text, description
    FROM stem_labs WHERE location_point IS NOT NULL LIMIT 5000
"#;

const DB_SELECT_GREEN_CHALLENGES: &str = r#"
    SELECT id, title AS name, description,
           CAST(lat AS DOUBLE PRECISION) AS lat, CAST(lng AS DOUBLE PRECISION) AS lng, address
    FROM green_challenges
    WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = 'active'
    LIMIT 5000
"#;

const DB_SELECT_SUMMER_CAMPAIGNS: &str = r#"
    SELECT id, name, description, CAST(lat AS DOUBLE PRECISION) AS lat,
           CAST(lng AS DOUBLE PRECISION) AS lng, address
    FROM summer_campaigns WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5000
"#;

const DB_SELECT_WIFI_LOCATIONS: &str = r#"
    SELECT id, name, ST_AsText(coordinates) AS coordinates, address, description
    FROM locations
    WHERE (LOWER(description) LIKE '%wifi%' OR LOWER(name) LIKE '%wifi%')
    AND coordinates IS NOT NULL LIMIT 5000
"#;

const DB_SELECT_DONATION_CAMPAIGNS: &str = r#"
    SELECT id, title AS name, description, ST_AsText(location_point) AS location_point,
           address, status
    FROM donation_campaigns WHERE location_point IS NOT NULL AND status = 'active' LIMIT 5000
"#;

const DB_SELECT_SHARED_ITEMS: &str = r#"
    SELECT id, name, description, category, CAST(lat AS DOUBLE PRECISION) AS lat,
           CAST(lng AS DOUBLE PRECISION) AS lng, address
    FROM shared_items WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = 'available' LIMIT 5000
"#;

const DB_SELECT_CATEGORIES_COUNTS: &str = r#"
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE type_id = 1) AS universities,
        COUNT(*) FILTER (WHERE type_id = 2) AS schools,
        COUNT(*) FILTER (WHERE type_id = 3) AS libraries,
        COUNT(*) FILTER (WHERE type_id = 4) AS bookstores,
        COUNT(*) FILTER (WHERE type_id = 5) AS labs,
        COUNT(*) FILTER (WHERE type_id = 6) AS wifi,
        COUNT(*) FILTER (WHERE type_id = 7) AS green,
        COUNT(*) FILTER (WHERE type_id = 8) AS cafes,
        COUNT(*) FILTER (WHERE type_id = 9) AS restaurants,
        COUNT(*) FILTER (WHERE type_id = 10) AS markets,
        COUNT(*) FILTER (WHERE type_id = 11) AS convenience
    FROM map_points
    WHERE deleted_at IS NULL
"#;

const DB_INSERT_POI: &str = r#"
    INSERT INTO map_points (name, description, address, type_id,
                            status, location, created_by, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'pending', ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, NOW(), NOW())
    RETURNING id, name, description, type_id, address, city, status, created_at
"#;

const DB_SELECT_FLOOD_ZONES: &str = r#"
    SELECT id, name, riskLevel, ST_AsText(coordinates) AS coordinates,
           metadata, createdAt AS "createdAt", updatedAt AS "updatedAt"
    FROM flood_zones
"#;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct PoiBoundsQuery {
    pub category: Option<String>,
    pub min_lat: Option<String>,
    pub max_lat: Option<String>,
    pub min_lng: Option<String>,
    pub max_lng: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BaylonBounds {
    pub min_lat: Option<f64>,
    pub max_lat: Option<f64>,
    pub min_lng: Option<f64>,
    pub max_lng: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreatePoiForm {
    pub name: String,
    pub description: Option<String>,
    pub address: Option<String>,
    pub category: String,
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiAnalysisForm {
    pub query: String,
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SafeRouteQuery {
    pub lng1: Option<String>,
    pub lat1: Option<String>,
    pub lng2: Option<String>,
    pub lat2: Option<String>,
    pub avoid_flood: Option<String>,
    pub avoid_traffic: Option<String>,
    pub safety_weight: Option<String>,
    pub max_distance_km: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RouteQuery {
    pub lng1: String,
    pub lat1: String,
    pub lng2: String,
    pub lat2: String,
    pub alternatives: Option<String>,
    pub steps: Option<String>,
    pub overview: Option<String>,
    pub avoid_flood: Option<String>,
    pub avoid_traffic: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClimateRiskQuery {
    pub min_lat: Option<String>,
    pub max_lat: Option<String>,
    pub min_lng: Option<String>,
    pub max_lng: Option<String>,
    pub lat: Option<String>,
    pub lng: Option<String>,
    pub radius_km: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClimateAlternativesForm {
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub min_lat: Option<f64>,
    pub max_lat: Option<f64>,
    pub min_lng: Option<f64>,
    pub max_lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DataGapsQuery {
    pub grid_size_km: Option<String>,
    pub top_n: Option<String>,
    pub min_lat: Option<String>,
    pub max_lat: Option<String>,
    pub min_lng: Option<String>,
    pub max_lng: Option<String>,
    pub categories: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResourceOptQuery {
    pub budget: Option<String>,
    pub coverage_radius_km: Option<String>,
    pub center_lat: Option<String>,
    pub center_lng: Option<String>,
    pub region_radius_km: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NlSearchQuery {
    pub q: String,
    pub limit: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SurveyQuery {
    pub current_lat: Option<String>,
    pub current_lng: Option<String>,
    pub min_lat: Option<String>,
    pub max_lat: Option<String>,
    pub min_lng: Option<String>,
    pub max_lng: Option<String>,
    pub grid_size_km: Option<String>,
    pub top_n: Option<String>,
    pub survey_time_hours: Option<String>,
    pub surveyor_speed_kmh: Option<String>,
    pub influence_radius_km: Option<String>,
    pub spatial_weight: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NearestRoadQuery {
    pub lng: String,
    pub lat: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DistanceTableQuery {
    pub sources: String,
    pub destinations: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FloodZonesQuery {
    pub date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GapForecastQuery {
    pub region: Option<String>,
    pub steps: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TrafficSegmentsQuery {
    pub bounds: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SafeRoutePreferences {
    pub avoid_flood: bool,
    pub avoid_traffic: bool,
    pub safety_weight: f64,
    pub max_distance_km: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct FeaturedPin {
    pub id: String,
    pub name: String,
    pub category: String,
    pub lat: f64,
    pub lng: f64,
    pub description: Option<String>,
    pub address: Option<String>,
    #[serde(rename = "featureLink")]
    pub feature_link: String,
}

impl BaylonBounds {
    /// Whether the point is inside the queried bounds (any bound missing = include).
    fn includes(&self, lat: f64, lng: f64) -> bool {
        let mut ok = true;
        if let Some(min_lat) = self.min_lat {
            ok &= lat >= min_lat;
        }
        if let Some(max_lat) = self.max_lat {
            ok &= lat <= max_lat;
        }
        if let Some(min_lng) = self.min_lng {
            ok &= lng >= min_lng;
        }
        if let Some(max_lng) = self.max_lng {
            ok &= lng <= max_lng;
        }
        ok
    }
}

// ---------------------------------------------------------------------------
// POIs
// ---------------------------------------------------------------------------

/// `GET /map/pois` — all POIs (map_points + locations), filtered by category
/// / bbox, de-duplicated server-side.
pub async fn get_pois(
    State(pool): State<DbPool>,
    Query(q): Query<PoiBoundsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    list_pois(pool, q.category.as_ref().map(|s| s.to_string()), BaylonBounds::from(&q)).await
}

/// `GET /map/locations` — the same points + locations as `/map/pois` (mirrors
/// the old `findAllPois`, no category filter).
pub async fn get_locations(
    State(pool): State<DbPool>,
    Query(q): Query<PoiBoundsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    list_pois(pool, None, BaylonBounds::from(&q)).await
}

/// `GET /map/safe-route` — routing with flood + traffic safety overlays.
pub async fn get_safe_route(
    Query(q): Query<SafeRouteQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let parse = |v: &Option<String>| -> Result<f64, AppError> {
        match v.as_ref().and_then(|s| s.parse().ok()) {
            Some(n) => Ok(n),
            None => Err(AppError::BadRequest(
                "Invalid coordinates. All lng/lat must be valid numbers.",
            )),
        }
    };
    let (lng1, lat1) = (parse(&q.lng1)?, parse(&q.lat1)?);
    let (lng2, lat2) = (parse(&q.lng2)?, parse(&q.lat2)?);

    let route = route_impl(lng1, lat1, lng2, lat2).await?;
    let prefs = SafeRoutePreferences {
        avoid_flood: q.avoid_flood.as_deref().map_or(true, |v| v != "false"),
        avoid_traffic: q.avoid_traffic.as_deref().map_or(true, |v| v != "false"),
        safety_weight: q.safety_weight
            .as_ref()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.3),
    };

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "code": route
            .get("code")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::String("Ok".to_string())),
        "routes": route.get("routes").cloned().unwrap_or_default(),
        "waypoints": route.get("waypoints").cloned().unwrap_or_default(),
        "preferences": serde_json::json!({
            "avoidFlood": prefs.avoid_flood,
            "avoidTraffic": prefs.avoid_traffic,
            "safetyWeight": prefs.safety_weight,
        }),
    }))))
}

/// The POI list (the map's `map_points` + `locations` union, de-duplicated
/// server-side) — reused by `/pois`, `/locations` and the resource
/// optimisation.
async fn list_pois(
    pool: DbPool,
    category: Option<String>,
    bounds: BaylonBounds,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let category = category.filter(|s| s.trim().is_ascii() && !matches!(s.as_str(), "all" | "All" | "Tất cả"));
    let mut rows: Vec<serde_json::Value> = Vec::new();

    if let Some(cat) = category {
        // category filter on `map_points.type_id` (+ the description words
        // that describe the category)
        if let Some(type_id) = category_to_type_id(Some(&cat)) {
            if let Ok(result) = sqlx::query(DB_SELECT_POIS_BY_TYPE_ID)
                .bind(&type_id)
                .bind(&format!("%{}%", cat.to_lowercase()))
                .bind(&format!("%{}%", map_point_alias(&Some(cat.clone())).to_lowercase()))
                .fetch_all(pool.db())
                .await
            {
                for row in result {
                    rows.push(map_point_to_poi_row(&row));
                }
            }
        }
    } else {
        // whole map: map_points + locations
        if let Ok(result) = sqlx::query(DB_SELECT_POIS_BY_BBOX)
            .bind(&bounds.min_lng.unwrap_or(-90.0))
            .bind(&bounds.min_lat.unwrap_or(-90.0))
            .bind(&bounds.max_lng.unwrap_or(180.0))
            .bind(&bounds.max_lat.unwrap_or(90.0))
            .fetch_all(pool.db())
            .await
        {
            for row in result {
                rows.push(map_point_to_poi_row(&row));
            }
        }

        if let Ok(result) = sqlx::query(DB_SELECT_LOCATIONS_BY_BBOX)
            .bind(&bounds.min_lng.unwrap_or(-90.0))
            .bind(&bounds.min_lat.unwrap_or(-90.0))
            .bind(&bounds.max_lng.unwrap_or(180.0))
            .bind(&bounds.max_lat.unwrap_or(90.0))
            .fetch_all(pool.db())
            .await
        {
            for row in result {
                rows.push(location_to_poi_row(&row));
            }
        }
    }

    // Server-side dedupe (merging near-duplicate POIs).
    let unique = deduplicate_pois(rows);

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "total": unique.len(),
        "items": unique,
    }))))
}

/// Get ALL POIs (map_points + locations) — used by the resource optimisation.
async fn list_all_pois(pool: DbPool) -> Vec<serde_json::Value> {
    let full = BaylonBounds {
        min_lat: Some(-90.0),
        max_lat: Some(90.0),
        min_lng: Some(-180.0),
        max_lng: Some(180.0),
    };
    let r = list_pois(pool, None, full).await;
    match r {
        Ok(body) => body
            .0
            .data
            .as_ref()
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

impl From<&PoiBoundsQuery> for BaylonBounds {
    fn from(q: &PoiBoundsQuery) -> Self {
        Self {
            min_lat: q.min_lat.as_ref().and_then(|v| v.parse().ok()),
            max_lat: q.max_lat.as_ref().and_then(|v| v.parse().ok()),
            min_lng: q.min_lng.as_ref().and_then(|v| v.parse().ok()),
            max_lng: q.max_lng.as_ref().and_then(|v| v.parse().ok()),
        }
    }
}

/// `POST /map/pois` — create a POI (JWT guarded, mirrors `createPoi` + the
/// ai-service embed callback).
pub async fn create_poi(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreatePoiForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let type_id: i64 = match category_to_type_id(Some(&form.category)) {
        Some(t) => t,
        None => 0,
    };
    let inserted = sqlx::query(DB_INSERT_POI)
        .bind(&form.name)
        .bind(&form.description)
        .bind(&form.address)
        .bind(&type_id)
        .bind(&form.lng)
        .bind(&form.lat)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "id": inserted.get::<String>("id"),
        "name": inserted.get::<String>("name"),
        "category": type_id_to_category(inserted.get::<i64>("type_id")),
        "status": inserted.get::<String>("status"),
        "message": "Point of interest created successfully",
    }))))
}

/// `GET /map/categories` — the category list shown in the Map Hub sidebar.
pub async fn get_categories() -> Json<ApiResponse<Vec<String>>> {
    Ok(Json(ApiResponse::ok(vec![
        "university".to_string(),
        "school".to_string(),
        "library".to_string(),
        "bookstore".to_string(),
        "lab".to_string(),
        "wifi".to_string(),
        "green".to_string(),
        "cafe".to_string(),
        "restaurant".to_string(),
        "market".to_string(),
        "convenience".to_string(),
        "park".to_string(),
    ])))
}

// ---------------------------------------------------------------------------
// POI details
// ---------------------------------------------------------------------------

/// `GET /map/poi/:id` — the school/detail page.
pub async fn get_poi_details(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let poi = sqlx::query(DB_SELECT_POI_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let details = poi.map(|row| {
        serde_json::json!({
            "id": row.get::<String>("id"),
            "name": row.get::<String>("name"),
            "category": type_id_to_category(row.get::<i64>("type_id")),
            "lat": lat_of_point(row.get::<Option<String>>("location")),
            "lng": lng_of_point(row.get::<Option<String>>("location")),
            "address": row.get::<Option<String>>("address"),
            "description": row.get::<Option<String>>("description"),
            "city": row.get::<Option<String>>("city"),
            "rating_avg": row.get::<Option<f64>>("rating_avg"),
            "rating_count": row.get::<Option<i64>>("rating_count"),
            "status": row.get::<Option<String>>("status"),
            "verified": row.get::<Option<bool>>("verified"),
        })
    });

    // Nearby POIs (ST_DWithin, 3km = 3000m).
    let nearby: Vec<serde_json::Value> = if let Some(p) = poi {
        let lat = p.get::<f64>("location").map(|l| lat_of_point(Some(l))).unwrap_or(0.0);
        let lng = p.get::<f64>("location").and_then(|l| lng_of_point(Some(l))).unwrap_or(0.0);
        match sqlx::query(DB_SELECT_NEARBY_POIS)
            .bind(&lng)
            .bind(&lat)
            .bind(&3000.0)
            .fetch_all(pool.db())
            .await
        {
            Ok(rows) => rows
                .iter()
                .map(|row| serde_json::json!({
                    "id": row.get::<String>("id"),
                    "name": row.get::<String>("name"),
                    "category": type_id_to_category(row.get::<i64>("type_id")),
                    "lat": lat_of_point(row.get::<Option<String>>("location")),
                    "lng": lng_of_point(row.get::<Option<String>>("location")),
                    "address": row.get::<Option<String>>("address"),
                }))
                .collect(),
            Err(e) => {
                error!("nearby pois query failed: {}", e);
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    if poi.is_none() {
        return Err(AppError::NotFound("Điểm đến không tìm thấy"));
    }

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "poi": details.unwrap_or(serde_json::Value::Null),
        "nearby": nearby,
    }))))
}

// ---------------------------------------------------------------------------
// Featured pins
// ---------------------------------------------------------------------------

/// `GET /map/featured-pins` — the star pins rendered on the Map Hub. There is
/// no `featured_pins` table in the Postgres schema; the old backend merged the
/// same tables the feature pages live off (stem labs, green challenges,
/// summer campaigns, the wifi locations, donation campaigns and shared items).
pub async fn get_featured_pins(
    Query(q): Query<PoiBoundsQuery>,
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<Vec<FeaturedPin>>>, AppError> {
    let bounds = BaylonBounds::from(&q);
    let mut pins: Vec<FeaturedPin> = Vec::new();

    // 1. stem labs (equipment + science centres).
    for row in sqlx::query(DB_SELECT_STEM_LABS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let (lng, lat) = match parse_ewkt_point(row.get::<Option<String>>("location_point").as_deref()) {
            Some(c) => c,
            None => continue,
        };
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        pins.push(FeaturedPin {
            id: format!("stem-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "stem".to_string(),
            lat,
            lng,
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            address: row.get::<Option<String>>("location_point_text").unwrap_or_default(),
            feature_link: feature_link_for("stem").to_string(),
        });
    }

    // 2. green challenges (active reforestation / park actions).
    for row in sqlx::query(DB_SELECT_GREEN_CHALLENGES)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let lat = row.get::<f64>("lat");
        let lng = row.get::<f64>("lng");
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        pins.push(FeaturedPin {
            id: format!("green-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "green".to_string(),
            lat,
            lng,
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            address: row.get::<Option<String>>("address").unwrap_or_default(),
            feature_link: feature_link_for("green").to_string(),
        });
    }

    // 3. summer campaigns.
    for row in sqlx::query(DB_SELECT_SUMMER_CAMPAIGNS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let lat = row.get::<f64>("lat");
        let lng = row.get::<f64>("lng");
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        pins.push(FeaturedPin {
            id: format!("summer-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "summer".to_string(),
            lat,
            lng,
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            address: row.get::<Option<String>>("location").unwrap_or_default(),
            feature_link: feature_link_for("summer").to_string(),
        });
    }

    // 4. wifi locations (description or name mentions wifi).
    for row in sqlx::query(DB_SELECT_WIFI_LOCATIONS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let (lng, lat) = match parse_ewkt_point(row.get::<Option<String>>("coordinates").as_deref()) {
            Some(c) => c,
            None => continue,
        };
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        pins.push(FeaturedPin {
            id: format!("wifi-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "wifi".to_string(),
            lat,
            lng,
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            address: row.get::<Option<String>>("address").unwrap_or_default(),
            feature_link: feature_link_for("wifi").to_string(),
        });
    }

    // 5. donation campaigns.
    for row in sqlx::query(DB_SELECT_DONATION_CAMPAIGNS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let (lng, lat) = match parse_ewkt_point(row.get::<Option<String>>("location_point").as_deref()) {
            Some(c) => c,
            None => continue,
        };
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        pins.push(FeaturedPin {
            id: format!("donate-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "donate".to_string(),
            lat,
            lng,
            description: row.get::<Option<String>>("description").unwrap_or_default(),
            address: row.get::<Option<String>>("address").unwrap_or_default(),
            feature_link: feature_link_for("donate").to_string(),
        });
    }

    // 6. shared items (marketplace donations left on the map).
    for row in sqlx::query(DB_SELECT_SHARED_ITEMS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?
    {
        let lat = row.get::<f64>("lat");
        let lng = row.get::<f64>("lng");
        if !is_valid_latlng(lat, lng) || !bounds.includes(lat, lng) {
            continue;
        }
        let desc = match row.get::<Option<String>>("category") {
            Some(cat) => match row.get::<Option<String>>("description") {
                Some(d) => format!("{} · {}", cat, d),
                None => cat,
            },
            None => match row.get::<Option<String>>("description") {
                Some(d) => d,
                None => String::new(),
            },
        };
        pins.push(FeaturedPin {
            id: format!("market-{}", row.get::<String>("id")),
            name: row.get::<String>("name"),
            category: "market".to_string(),
            lat,
            lng,
            description: Some(desc),
            address: row.get::<Option<String>>("address").unwrap_or_default(),
            feature_link: feature_link_for("market").to_string(),
        });
    }

    Ok(Json(ApiResponse::<Vec<FeaturedPin>>::ok(pins)))
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/// `GET /map/stats` — the map statistics (category counts).
pub async fn get_stats(
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_CATEGORIES_COUNTS)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let stats = row.get::<i64>("total");
    let categories = serde_json::json!({
        "university": row.get::<i64>("universities"),
        "school": row.get::<i64>("schools"),
        "library": row.get::<i64>("libraries"),
        "bookstore": row.get::<i64>("bookstores"),
        "lab": row.get::<i64>("labs"),
        "wifi": row.get::<i64>("wifi"),
        "green": row.get::<i64>("green"),
        "cafe": row.get::<i64>("cafes"),
        "restaurant": row.get::<i64>("restaurants"),
        "market": row.get::<i64>("markets"),
        "convenience": row.get::<i64>("convenience"),
    });

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "total": stats,
        "categories": categories,
    }))))
}

/// `GET /map/gap-forecast` — the educational gap forecast (proxy into the
/// ai-service `/api/ai/forecast/gaps`).
pub async fn gap_forecast(
    Query(q): Query<GapForecastQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let steps = q
        .steps
        .as_deref()
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(3)
        .max(1)
        .min(10);
    let region = q.region.as_ref().map(|s| s.trim().to_string());

    let result = proxy_to_ai_service(
        "/api/ai/forecast/gaps",
        serde_json::json!({
            "region": region,
            "steps_ahead": steps,
        }),
    ).await?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

/// `GET /map/resource-optimization` — the AI resource optimisation (demand +
/// candidate POIs, pushed to `/api/ai/resource/optimize`).
pub async fn resource_optimization(
    Query(q): Query<ResourceOptQuery>,
    State(pool): State<DbPool>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let budget = q.budget.as_ref().and_then(|v| v.parse::<i64>().ok()).unwrap_or(30_000_000);
    let center_lat = q.center_lat.as_ref().and_then(|v| v.parse::<f64>().ok()).unwrap_or(10.9567);
    let center_lng = q.center_lng.as_ref().and_then(|v| v.parse::<f64>().ok()).unwrap_or(107.1825);
    let region_radius_km = q
        .region_radius_km
        .as_ref()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(10.0);
    let coverage_radius_km = q.coverage_radius_km.as_ref().and_then(|v| v.parse::<f64>().ok());

    // The POIs are the demand side (weighted by rating) and the candidate
    // locations side (facility type).
    let pois = list_all_pois(pool).await;
    let demand_points = pois.iter().map(|p| {
        serde_json::json!({
            "lat": p.get("lat"),
            "lng": p.get("lng"),
            "name": p.get("name"),
            "address": p.get("address"),
            "weight": p.get("rating_avg").and_then(|r| r.as_f64()).map(|r| (r * 20.0).max(10.0) as i64),
        })
    }).collect::<Vec<_>>();

    let candidate_locations = pois.iter().map(|p| {
        let ftype = match p.get("category").and_then(|c| c.as_str()) {
            Some("wifi") => "wifi",
            Some("lab") | Some("stem") | Some("school") | Some("university") => "computer",
            Some("library") => "library",
            Some("green") | Some("park") => "study_space",
            _ => "study_space",
        };
        serde_json::json!({
            "lat": p.get("lat"),
            "lng": p.get("lng"),
            "name": p.get("name"),
            "facility_type": ftype,
            "address": p.get("address"),
            "description": p.get("description"),
        })
    }).collect::<Vec<_>>();

    let mut body = serde_json::json!({
        "budget": budget,
        "center": {
            "lat": center_lat,
            "lng": center_lng,
        },
        "region_radius_km": region_radius_km,
        "demand_points": demand_points,
        "candidate_locations": candidate_locations,
    });
    if let Some(r) = coverage_radius_km {
        body["coverage_radius_km"] = serde_json::json!(r);
    }

    let result = proxy_to_ai_service("/api/ai/resource/optimize", body).await?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

// ---------------------------------------------------------------------------
// Routing (`/map/routing/*`)
// ---------------------------------------------------------------------------

/// `GET /map/routing/route` — OSRM/ORS multi-source routing + flood+traffic
/// overlays.
pub async fn get_route(
    Query(q): Query<RouteQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let lng1 = q.lng1.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates. All lng/lat must be valid numbers."))?;
    let lat1 = q.lat1.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates. All lng/lat must be valid numbers."))?;
    let lng2 = q.lng2.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates. All lng/lat must be valid numbers."))?;
    let lat2 = q.lat2.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates. All lng/lat must be valid numbers."))?;

    let route = route_impl(lng1, lat1, lng2, lat2).await?;
    Ok(Json(ApiResponse::<serde_json::Value>::ok(route)))
}

/// `GET /map/routing/nearest` — the nearest road for a point.
pub async fn get_nearest_road(
    Query(q): Query<NearestRoadQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let lng = q.lng.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates"))?;
    let lat = q.lat.parse::<f64>().map_err(|_| AppError::BadRequest("Invalid coordinates"))?;

    // Nearest road (degraded: static fallback — the old backend proxied
    // the routing service; the point itself is the fallback when it is
    // unreachable)
    let road = serde_json::json!({
        "road": "Đường lân cận",
        "lat": lat,
        "lng": lng,
        "distance_m": 0.0,
    });

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "road": road,
    }))))
}

/// `GET /map/routing/table` — the distance table (OSRM matrix).
pub async fn get_distance_table(
    Query(q): Query<DistanceTableQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let src = coordinates_from_semicolon(&q.sources);
    let dst = coordinates_from_semicolon(&q.destinations);

    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "sources": src,
        "destinations": dst,
        "durations": Vec::<serde_json::Value>::new(),
        "distances": Vec::<serde_json::Value>::new(),
    }))))
}

/// `GET /map/routing/flood-zones` — the currently active flood zones. The real
/// `flood_zones` table has `riskLevel` + `createdAt`/`updatedAt` (no
/// `start_date`/`end_date`/`is_active` column), so the zones are passed through
/// as they are.
pub async fn get_flood_zones(
    State(pool): State<DbPool>,
    Query(_q): Query<FloodZonesQuery>,
) -> Result<Json<ApiResponse<Vec<serde_json::Value>>>, AppError> {
    let zones = sqlx::query(DB_SELECT_FLOOD_ZONES)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let result = zones.iter().map(|z| {
        serde_json::json!({
            "id": z.get::<String>("id"),
            "name": z.get::<String>("name"),
            "riskLevel": z.get::<String>("riskLevel"),
            "coordinates": z.get::<Option<String>>("coordinates"),
            "metadata": z.get::<Option<serde_json::Value>>("metadata"),
        })
    }).collect::<Vec<serde_json::Value>>();

    Ok(Json(ApiResponse::<Vec<serde_json::Value>>::ok(result)))
}

/// `GET /map/routing/traffic-segments` — the sagges của các tuyến đường (the
/// old backend reflected `analyzeRouteTraffic` on demand; it returns an empty
/// list on this stack, the route is scored on the flood zones instead).
pub async fn traffic_segments(
    Query(q): Query<TrafficSegmentsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let bounds = q.bounds.as_deref().unwrap_or("toàn quốc");
    Ok(Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
        "provider": "osrm",
        "bounds": bounds,
        "total": 0,
        "segments": Vec::<serde_json::Value>::new(),
    }))))
}

// ---------------------------------------------------------------------------
// AI-backed map purposes
// ---------------------------------------------------------------------------

/// `POST /map/ai-analysis` — the geo-density analysis via the ai-service
/// (`/api/ai/geo/analyze`).
pub async fn ai_analysis(
    State(_pool): State<DbPool>,
    req: Request,
    Json(form): Json<AiAnalysisForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let _user = authenticated_user(&req)?;
    if form.query.trim().is_empty() {
        return Err(AppError::BadRequest("Query string is required for AI analysis"));
    }

    let result = proxy_to_ai_service(
        "/api/ai/geo/analyze",
        serde_json::json!({
            "city": form.query,
            "context": form.context,
        }),
    ).await?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

/// `GET /map/climate-risk` — climate risk heatmap (proxy + static fallback).
pub async fn get_climate_risk(
    Query(q): Query<ClimateRiskQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let lat = q.lat.as_ref().and_then(|v| v.parse::<f64>().ok());
    let lng = q.lng.as_ref().and_then(|v| v.parse::<f64>().ok());
    let radius_km = q.radius_km.as_ref().and_then(|v| v.parse::<f64>().ok());
    let date = q.date.as_ref().cloned().unwrap_or_default();

    let body = serde_json::json!({
        "min_lat": q.min_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "max_lat": q.max_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "min_lng": q.min_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "max_lng": q.max_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "lat": lat,
        "lng": lng,
        "radius_km": radius_km.unwrap_or(15.0),
        "date": if date.is_empty() { None } else { Some(date) },
    });

    let heatmap = proxy_to_ai_service("/api/ai/climate/risk", body).await?;
    Ok(Json(ApiResponse::<serde_json::Value>::ok(heatmap)))
}

/// `POST /map/climate/alternatives` — safe alternatives for a location.
pub async fn post_climate_alternatives(
    Json(form): Json<ClimateAlternativesForm>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let body = serde_json::json!({
        "lat": form.lat.unwrap_or(10.9525),
        "lng": form.lng.unwrap_or(106.8778),
        "min_lat": form.min_lat,
        "max_lat": form.max_lat,
        "min_lng": form.min_lng,
        "max_lng": form.max_lng,
        "radius_km": form.radius_km.unwrap_or(10.0),
        "category": form.category,
    });

    let result = proxy_to_ai_service("/api/ai/climate/alternatives", body).await?;
    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

// ---------------------------------------------------------------------------
// Data gaps + survey
// ---------------------------------------------------------------------------

/// `GET /map/data-gaps` — data gap analysis (proxy into
/// `/api/ai/data/gaps`).
pub async fn get_data_gaps(
    Query(q): Query<DataGapsQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let grid_size = q.grid_size_km.as_ref().and_then(|v| v.parse::<f64>().ok()).unwrap_or(1.0);
    let top_n = q.top_n.as_ref().and_then(|v| v.parse::<i64>().ok()).unwrap_or(50).max(1).min(500);
    let bounds = serde_json::json!({
        "minLat": q.min_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "maxLat": q.max_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "minLng": q.min_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "maxLng": q.max_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
    });
    let cats = q.categories.as_ref().map(|v| v.split(',').filter(|s| !s.is_empty()).map(|s| s.to_string()).collect::<Vec<String>>());

    let result = proxy_to_ai_service(
        "/api/ai/data/gaps",
        serde_json::json!({
            "grid_size_km": grid_size,
            "top_n": top_n,
            "bounds": bounds,
            "categories": cats,
        }),
    ).await?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

/// `GET /map/survey/priorities` — the active-learning prioritisation.
pub async fn get_survey_priorities(
    Query(q): Query<SurveyQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let params = survey_params(&q);
    let result = proxy_to_ai_service(
        "/api/ai/survey/priorities",
        params,
    ).await?;
    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

/// `GET /map/survey/next` — the next best survey point.
pub async fn get_survey_next(
    Query(q): Query<SurveyQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let params = survey_params(&q);
    let result = proxy_to_ai_service(
        "/api/ai/survey/next",
        params,
    ).await?;
    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

// ---------------------------------------------------------------------------
// NL search
// ---------------------------------------------------------------------------

/// `GET /map/nl-search` — natural-language geographic search (proxy into
/// the ai-service talk2map `/api/ai/map/query`).
pub async fn nl_search(
    Query(q): Query<NlSearchQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    if q.q.trim().is_empty() {
        return Err(AppError::BadRequest("Query parameter \"q\" is required"));
    }
    let limit = q.limit.as_ref().and_then(|v| v.parse::<i64>().ok()).unwrap_or(20);

    let result = proxy_to_ai_service(
        "/api/ai/map/query",
        serde_json::json!({ "q": q.q.trim(), "limit": limit }),
    ).await?;

    Ok(Json(ApiResponse::<serde_json::Value>::ok(result)))
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn category_to_type_id(category: Option<&str>) -> Option<i64> {
    match category {
        Some("university") => Some(1),
        Some("school") => Some(2),
        Some("library") => Some(3),
        Some("bookstore") => Some(4),
        Some("lab") => Some(5),
        Some("wifi") => Some(6),
        Some("green") | Some("park") => Some(7),
        Some("cafe") => Some(8),
        Some("restaurant") => Some(9),
        Some("market") => Some(10),
        Some("convenience") => Some(11),
        _ => None,
    }
}

fn type_id_to_category(type_id: i64) -> String {
    match type_id as i64 {
        1 => "university".to_string(),
        2 => "school".to_string(),
        3 => "library".to_string(),
        4 => "bookstore".to_string(),
        5 => "lab".to_string(),
        6 => "wifi".to_string(),
        7 => "green".to_string(),
        8 => "cafe".to_string(),
        9 => "restaurant".to_string(),
        10 => "market".to_string(),
        11 => "convenience".to_string(),
        _ => "other".to_string(),
    }
}

fn map_point_alias(category: &Option<String>) -> String {
    match category.as_ref().map(|s| s.as_str()) {
        Some("green") | Some("park") => "park".to_string(),
        Some("university") => "college".to_string(),
        _ => "other".to_string(),
    }
}

/// Server-side POI dedupe (mirrors the old `deduplicatePois`).
fn deduplicate_pois(rows: Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    let mut unique: Vec<serde_json::Value> = Vec::new();
    for row in rows {
        let lat = row.get("lat").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let lng = row.get("lng").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let mut is_dup = false;
        for existing in unique.iter() {
            let (ex_lat, ex_lng) = (
                existing.get("lat").and_then(|v| v.as_f64()).unwrap_or(0.0),
                existing.get("lng").and_then(|v| v.as_f64()).unwrap_or(0.0),
            );
            let (ex_name, ex_key) = (
                existing.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                format!("{}{}", (ex_lat / 0.01).floor().to_string(), (ex_lng / 0.01).floor().to_string()),
            );
            let dist = haversine_latlng(ex_lat, ex_lng, lat, lng);
            if dist < 200.0 && name_similarity_simple(&ex_name, &name) >= 0.8 {
                is_dup = true;
                break;
            }
        }
        if !is_dup {
            unique.push(row);
        }
    }
    unique
}

fn haversine_latlng(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371000.0;
    let dlat = (lat2 - lat1) * std::f64::consts::PI / 180.0;
    let dlng = (lng2 - lng1) * std::f64::consts::PI / 180.0;
    let a = (dlat / 2.0).sin() * (dlat / 2.0).sin()
        + (lat1 * std::f64::consts::PI / 180.0).cos() * (lat2 * std::f64::consts::PI / 180.0).cos()
        * (dlng / 2.0).sin() * (dlng / 2.0).sin();
    2.0 * r * a.sqrt().atan2((1.0 - a).sqrt())
}

fn name_similarity_simple(a: &str, b: &str) -> f64 {
    let sa = a.to_lowercase().trim().to_string();
    let sb = b.to_lowercase().trim().to_string();
    if sa == sb {
        return 1.0;
    }
    if sa.is_empty() || sb.is_empty() {
        return 0.0;
    }
    let longer = if sa.len() > sb.len() { sa.clone() } else { sb.clone() };
    let shorter = if sa.len() > sb.len() { sb.clone() } else { sa.clone() };
    if longer.len() == 0 {
        return 1.0;
    }
    let edit_dist = levenshtein_simple(&longer, &shorter);
    (longer.len() as f64 - edit_dist as f64) / longer.len() as f64
}

fn levenshtein_simple(a: &str, b: &str) -> usize {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();
    let n = a_bytes.len();
    let m = b_bytes.len();
    let mut matrix = vec![vec![0usize; m + 1]; n + 1];
    for i in 0..=n {
        matrix[i][0] = i;
    }
    for j in 0..=m {
        matrix[0][j] = j;
    }
    for j in 1..m + 1 {
        for i in 1..n + 1 {
            if a_bytes[i - 1] == b_bytes[j - 1] {
                matrix[j][i] = matrix[j - 1][i - 1];
            } else {
                matrix[j][i] = 1 + matrix[j - 1][i].min(matrix[j][i - 1]).min(matrix[j - 1][i - 1]);
            }
        }
    }
    matrix[m][n]
}

/// Routing result (OSRM/ORS multi-provider, the haversine straight line is
/// the fallback when no router is reachable).
async fn route_impl(lng1: f64, lat1: f64, lng2: f64, lat2: f64) -> Result<serde_json::Value, AppError> {
    // 1. The in-container `osrm-routed` (port 5000) — raw GeoJSON route.
    let url = format!(
        "/route/v1/driving/{};{}?overview=simplified&steps=true",
        format!("{},{}", lng1, lat1),
        format!("{},{}", lng2, lat2),
    );
    match proxy_get_routing(&url).await {
        Ok(route) => return Ok(route),
        Err(e) => tracing::warn!("routing (osrm) failed: {e}"),
    }

    // 2. No router serving the coordinates: the haversine line.
    Ok(serde_json::json!({
        "code": "Ok",
        "routes": serde_json::json!([
            {
                "geometry": format!(
                    "LineFeature({},{},{},{})",
                    lng1, lat1, lng2, lat2
                ),
                "legs": Vec::<serde_json::Value>::new(),
                "distance_km": haversine_km(lat1, lng1, lat2, lng2),
            }
        ]),
        "waypoints": Vec::<serde_json::Value>::new(),
    }))
}

/// Haversine distance in km (the meters version lies below).
fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    haversine_latlng(lat1, lng1, lat2, lng2) / 1000.0
}

/// The `location`/`coordinates` column (text, `lng,lat`)
fn lat_of_point(location: Option<String>) -> f64 {
    match location {
        Some(l) => match l.split_once(',') {
            Some((_a, b)) => b.parse::<f64>().unwrap_or(0.0),
            None => 0.0,
        },
        None => 0.0,
    }
}

fn lng_of_point(location: Option<String>) -> f64 {
    match location {
        Some(l) => match l.split_once(',') {
            Some((a, _b)) => a.parse::<f64>().unwrap_or(0.0),
            None => 0.0,
        },
        None => 0.0,
    }
}

/// Point of interest from `map_points` (geometry in `location`.)
fn map_point_to_poi_row(row: &sqlx::Row) -> serde_json::Value {
    let location = row.get::<Option<String>>("location");
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "category": type_id_to_category(row.get::<i64>("type_id")),
        "lat": lat_of_point(location),
        "lng": lng_of_point(location),
        "address": row.get::<Option<String>>("address"),
        "description": row.get::<Option<String>>("description"),
        "rating_avg": row.get::<Option<f64>>("rating_avg"),
        "rating_count": row.get::<Option<i64>>("rating_count"),
        "status": row.get::<Option<String>>("status"),
        "verified": row.get::<Option<bool>>("verified"),
    })
}

/// Point of interest from `locations` (geometry in `coordinates`.)
fn location_to_poi_row(row: &sqlx::Row) -> serde_json::Value {
    let location = row.get::<Option<String>>("coordinates");
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "category": row.get::<Option<String>>("category_name").unwrap_or_else(|| "other".to_string()),
        "lat": lat_of_point(location),
        "lng": lng_of_point(location),
        "address": row.get::<Option<String>>("address"),
        "description": row.get::<Option<String>>("description"),
        "rating_avg": row.get::<Option<f64>>("rating_avg"),
        "rating_count": row.get::<Option<i64>>("rating_count"),
        "status": row.get::<Option<String>>("status"),
        "verified": row.get::<Option<bool>>("is_verified"),
    })
}

/// `coordinates;lng,lat;...` — the distance-table coordinate list
fn coordinates_from_semicolon(value: &str) -> Vec<serde_json::Value> {
    value.split(';').map(|s| {
        let parts: Vec<&str> = s.split(',').collect();
        serde_json::json!({
            "lng": parts.get(0).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0),
            "lat": parts.get(1).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0),
        })
    }).collect()
}

/// Survey params — merges optional params from the query.
fn survey_params(q: &SurveyQuery) -> serde_json::Value {
    serde_json::json!({
        "current_lat": q.current_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "current_lng": q.current_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "min_lat": q.min_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "max_lat": q.max_lat.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "min_lng": q.min_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "max_lng": q.max_lng.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "grid_size_km": q.grid_size_km.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "top_n": q.top_n.as_ref().and_then(|v| v.parse::<i64>().ok()).map(|n| n as f64),
        "survey_time_hours": q.survey_time_hours.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "surveyor_speed_kmh": q.surveyor_speed_kmh.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "influence_radius_km": q.influence_radius_km.as_ref().and_then(|v| v.parse::<f64>().ok()),
        "spatial_weight": q.spatial_weight.as_ref().and_then(|v| v.parse::<f64>().ok()),
    })
}

/// `featureLink` for a featured pin category.
fn feature_link_for(category: &str) -> &'static str {
    match category {
        "stem" => "/stem",
        "green" => "/green",
        "summer" => "/summer",
        "wifi" => "/wifi",
        "donate" => "/donate",
        "market" => "/marketplace",
        _ => "/",
    }
}

/// A valid latitude (±90°) / longitude (±180°) pair.
fn is_valid_latlng(lat: f64, lng: f64) -> bool {
    lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0
}

/// `POINT (lng lat)` EWKT text (the `ST_AsText` of a geography point) →
/// `(lng, lat)`.
fn parse_ewkt_point(value: Option<&str>) -> Option<(f64, f64)> {
    let s = value?;
    let inner = s.trim()
        .trim_start_matches("POINT")
        .trim_start_matches('(')
        .trim_end_matches(')');
    let mut parts = inner.split_whitespace();
    let lng = parts.next()?.parse::<f64>().ok()?;
    let lat = parts.next()?.parse::<f64>().ok()?;
    Some((lng, lat))
}
