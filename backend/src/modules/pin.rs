//! Pins module — `/api/pins/*`: ghim lên bản đồ (danh sách, chi tiết, tạo,
//! sửa, xóa).
//!
//! Routing table (áp dụng `Router::layer(AuthLayer)` trong `router.rs`; các
//! endpoint đọc danh sách là `PUBLIC_PATHS` nên khách vãng lai cũng đến được,
//! các handler viết tự kiểm JWT và trả `401` khi token thiếu):
//!
//! ```text
//! GET  /api/pins            -> public, danh sách pin đã duyệt (hoặc ?mine=true
//!                             khi đăng nhập)
//! GET  /api/pins/:id        -> public, chi tiết pin đã duyệt
//! POST /api/pins            -> JWT, tạo pin (mặc định `pending` chờ admin duyệt)
//! PATCH /api/pins/:id       -> JWT, sửa pin (chủ sở hữu / admin)
//! DELETE /api/pins/:id      -> JWT, xóa mềm pin (chủ sở hữu / admin)
//! ```
//!
//! Mirrors `backend/src/modules/pin/pin.controller.ts` + `pin.service.ts`.
//! `pins.location` là cột `GEOMETRY(Geometry, 4326)`: đọc `ST_AsText`
//! (`POINT (lng lat)`), viết `ST_SetSRID(ST_GeomFromGeoJSON(<geojson>), 4326)`.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::Request<Body>;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers (auth layer + admin role)
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: (`PUBLIC_PATHS` không đưa `AuthUser` vào request ở
/// các route public, nên các handler write tự kiểm JWT, trả `401` khi token
/// thiếu).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` / `super_admin` (tương đương `@Roles(ADMIN, MODERATOR)`).
fn is_admin(user: &AuthUser) -> bool {
    matches!(
        user.role.as_str(),
        "admin" | "moderator" | "super_admin"
    )
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

/// `SELECT` một pin theo id (đã bao gồm cả các trường rejected/pending cho
/// chủ sở hữu + admin).
const DB_SELECT_PIN_BY_ID: &str = r#"
    SELECT id, title, content, CAST(type AS TEXT) AS type,
           poster_name, posted_by, ST_AsText(location) AS location,
           city, district, province,
           CAST(photos AS TEXT) AS photos, CAST(tags AS TEXT) AS tags,
           status, CAST(created_at AS TEXT) AS created_at,
           CAST(updated_at AS TEXT) AS updated_at
    FROM pins WHERE id = $1 AND deleted_at IS NULL
"#;

/// `SELECT` danh sách pin (filter NEWS INTO SQL text, `limit/offset` bind).
const DB_SELECT_PINS: &str = r#"
    SELECT id, title, content, CAST(type AS TEXT) AS type,
           poster_name, posted_by, ST_AsText(location) AS location,
           city, district, province,
           CAST(photos AS TEXT) AS photos, CAST(tags AS TEXT) AS tags,
           status, CAST(created_at AS TEXT) AS created_at,
           CAST(updated_at AS TEXT) AS updated_at
    FROM pins WHERE deleted_at IS NULL
"#;

/// Insert một pin mới + `RETURNING` để trả về field đầy đủ.
const DB_INSERT_PIN: &str = r#"
    INSERT INTO pins (title, content, type, poster_name, posted_by,
                      location, city, district, province, status, photos, tags,
                      created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326),
            $7, $8, $9, $10, $11, $12, NOW(), NOW())
    RETURNING id, title, content, CAST(type AS TEXT) AS type,
              poster_name, posted_by, ST_AsText(location) AS location,
              city, district, province,
              CAST(photos AS TEXT) AS photos, CAST(tags AS TEXT) AS tags,
              status, CAST(created_at AS TEXT) AS created_at,
              CAST(updated_at AS TEXT) AS updated_at
"#;

/// `SELECT` `full_name` của một user dùng cho `poster_name` (dùng khi tạo pin).
const DB_USER_FULL_NAME: &str = r#"
    SELECT full_name FROM users WHERE id = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn pin_to_json(row: &sqlx::PgRow) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "content": row.get::<Option<String>>("content").unwrap_or_default(),
        "type": row.get::<Option<String>>("type").unwrap_or_default(),
        "poster_name": row.get::<Option<String>>("poster_name").unwrap_or_default(),
        "posted_by": row.get::<Option<String>>("posted_by").unwrap_or_default(),
        "location": row.get::<Option<String>>("location").unwrap_or_default(),
        "city": row.get::<Option<String>>("city").unwrap_or_default(),
        "district": row.get::<Option<String>>("district").unwrap_or_default(),
        "province": row.get::<Option<String>>("province").unwrap_or_default(),
        "photos": row.get::<Option<String>>("photos")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "tags": row.get::<Option<String>>("tags")
            .and_then(|s| serde_json::from_str(&s).ok()),
        "status": row.get::<String>("status"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
pub struct PinListQuery {
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub mine: Option<String>,
    #[serde(default)]
    pub bbox: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub offset: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct CreatePinRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(default)]
    pub kind: String,
    pub location: Option<Value>,
    pub city: Option<String>,
    pub district: Option<String>,
    pub province: Option<String>,
    pub photos: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePinRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub r#type: Option<String>,
    pub location: Option<Value>,
    pub city: Option<String>,
    pub district: Option<String>,
    pub province: Option<String>,
    pub photos: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/// Parse `bbox=w,s,e,n` into 4 envelopes (w = min lng, s = min lat, e = max
/// lng, n = max lat — the `array(#[w, #s, #e, #n])` order of the old service).
fn bbox_to_envelope(bbox: &str) -> Result<(f64, f64, f64, f64), AppError> {
    let parts: Vec<&str> = bbox.split(',').collect();
    if parts.len() != 4 {
        return Err(AppError::BadRequest(
            "bbox có định dạng `w,s,e,n` (4 số, cách nhau bởi dấu phẩy).".to_string(),
        ));
    }
    let to_f64 = |n: &str| -> Result<f64, AppError> {
        match n.trim().parse::<f64>() {
            Ok(v) => Ok(v),
            Err(_) => Err(AppError::BadRequest(
                "bbox: tất cả các giá trị phải là số.".to_string(),
            )),
        }
    };
    let w = to_f64(parts[0])?;
    let s = to_f64(parts[1])?;
    let e = to_f64(parts[2])?;
    let n = to_f64(parts[3])?;
    Ok((w, s, e, n))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/pins` — danh sách pin lên bản đồ (công khai: chỉ các pin đã
/// duyệt `published`; `?mine=true` = pin của riêng bạn).
pub async fn find_pins(
    State(pool): State<DbPool>,
    Query(q): Query<PinListQuery>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let mut filters: Vec<String> = Vec::new();
    let mut binds: Vec<Value> = Vec::new();

    // `mine=true` đòi hỏi người gọi đăng nhập (ghi danh được pin của riêng
    // họ — public pages cũng bật được `?mine=true` khi đăng nhập).
    let user = optional_user(&req);
    if q.mine.as_deref().filter(|v| v == "true").is_some() {
        let user_id = match user.as_ref() {
            Some(u) => u.id.clone(),
            None => return Err(AppError::Unauthorized(
                "Bạn cần đăng nhập để xem các pin của mình.".to_string(),
            )),
        };
        binds.push(Value::String(user_id));
        filters.push(format!("posted_by = ${}", binds.len()));
    } else {
        filters.push("status = 'published'".to_string());
    }

    if let Some(status) = q.status.as_ref().filter(|v| !v.trim().is_empty()) {
        binds.push(Value::String(status.to_string()));
        filters.push(format!("status = ${}", binds.len()));
    }

    if let Some(kind) = q.r#type.as_ref().filter(|v| !v.trim().is_empty()) {
        binds.push(Value::String(kind.to_string()));
        filters.push(format!("type = ${}", binds.len()));
    }

    if let Some(bbox) = q.bbox.as_ref().filter(|v| !v.trim().is_empty()) {
        let (w, s, e, n) = bbox_to_envelope(bbox)?;
        binds.push(w.into());
        binds.push(s.into());
        binds.push(e.into());
        binds.push(n.into());
        filters.push(format!(
            "ST_Intersects(location, ST_MakeEnvelope(${}, ${}, ${}, ${}, 4326))",
            binds.len() - 3,
            binds.len() - 2,
            binds.len() - 1,
            binds.len()
        ));
    }

    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!(" AND {}", filters.join(" AND "))
    };

    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let offset = q.offset.unwrap_or(0);

    let rows = sqlx::query(&format!(
        "{}{} ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        DB_SELECT_PINS, where_clause
    ))
    .bind(&limit)
    .bind(&offset)
    .binds(&binds)
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;

    let pins: Vec<Value> = rows.iter().map(pin_to_json).collect();

    Ok(Json(ApiResponse::ok(pins)))
}

/// `GET /api/pins/{id}` — chi tiết một pin (công khai: pin đã duyệt; pin
/// `pending` chỉ hiện với chủ sở hữu / admin).
pub async fn get_pin(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_PIN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Pin không tồn tại.".to_string())),
    };

    // Pin chưa duyệt (hoặc bị từ chối) chỉ hiện với chủ sở hữu và admin.
    let status = row.get::<String>("status");
    if status == "published" {
        return Ok(Json(ApiResponse::ok(pin_to_json(&row))));
    }

    let user_id = match optional_user(&req).as_ref() {
        Some(u) => u.id.as_str(),
        None => "",
    };
    let is_admin = optional_user(&req).as_ref().map_or(false, is_admin);

    let posted_by = row.get::<Option<String>>("posted_by").unwrap_or_default();
    if posted_by == user_id || is_admin {
        return Ok(Json(ApiResponse::ok(pin_to_json(&row))));
    }

    Err(AppError::NotFound("Pin không tồn tại.".to_string()))
}

/// `POST /api/pins` — tạo pin đăng tin lên bản đồ (poster tự gắn; mặc định
/// `pending` chờ admin duyệt).
pub async fn create_pin(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<CreatePinRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let title = match body.title.as_ref() {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Err(AppError::BadRequest("Tiêu đề pin không được rỗng.".to_string())),
    };

    // `photos`/`tags` → JSON text (jsonb), `location` → ST_GeomFromGeoJSON.
    let photos = body.photos.as_deref().map(|v| serde_json::to_string(v).unwrap_or_default());
    let tags = body.tags.as_deref().map(|v| serde_json::to_string(v).unwrap_or_default());
    let location = body.location.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default());

    // resolve poster_name = full_name của người đăng (ẩn danh nếu chưa đặt).
    let poster_name: Option<String> = sqlx::query(DB_USER_FULL_NAME)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .map(|row| row.get::<Option<String>>("full_name").unwrap_or_default());

    let filter = poster_name.as_ref().map(|v| !v.is_empty()).unwrap_or(false);
    let poster_name = if filter { poster_name } else { Some("Ẩn danh".to_string()) };
    let poster_name = poster_name.unwrap_or("Ẩn danh".to_string());

    let sql = DB_INSERT_PIN;
    let inserted_id: String = sqlx::query(sql)
        .bind(title.as_deref())
        .bind(body.content.as_deref())
        .bind(body.kind.as_deref().filter(|v| !v.trim().is_empty()).unwrap_or("event"))
        .bind(poster_name.as_str())
        .bind(&user.id)
        .bind(location.as_deref())
        .bind(body.city.as_deref())
        .bind(body.district.as_deref())
        .bind(body.province.as_deref())
        .bind("pending")
        .bind(photos.as_deref())
        .bind(tags.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?
        .get::<String>("id");

    let row = sqlx::query(DB_SELECT_PIN_BY_ID)
        .bind(&inserted_id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(pin_to_json(&row))))
}

/// `PATCH /api/pins/{id}` — sửa pin (chủ sở hữu, hoặc admin/super_admin).
pub async fn update_pin(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(body): Json<UpdatePinRequest>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_SELECT_PIN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Pin không tồn tại.".to_string())),
    };

    let posted_by = row.get::<Option<String>>("posted_by").unwrap_or_default();
    let user_id = user.id.as_str();
    let can_edit = posted_by == user_id || is_admin(&user);
    if !can_edit {
        return Err(AppError::Forbidden(
            "Chỉ chủ sở hữu hoặc admin mới được sửa pin.".to_string(),
        ));
    }

    // Builds `SET a = $1, b = $2` + binds (order = bindings.len + id).
    let mut set: Vec<String> = Vec::new();
    let mut binds: Vec<Value> = Vec::new();

    let push = |field: &str, value: Option<&str>| {
        if let Some(v) = value.filter(|v| !v.trim().is_empty()) {
            binds.push(Value::String(v.to_string()));
            set.push(format!("{} = ${}", field, binds.len()));
        }
    };

    push("title", body.title.as_deref());
    push("content", body.content.as_deref());
    push("type", body.r#type.as_deref());
    push("city", body.city.as_deref());
    push("district", body.district.as_deref());
    push("province", body.province.as_deref());
    push("status", body.status.as_deref());

    if let Some(photos) = body.photos.as_deref().filter(|v| !v.is_empty()) {
        binds.push(Value::String(serde_json::to_string(photos).unwrap_or_default()));
        set.push(format!("photos = ${}", binds.len()));
    }
    if let Some(tags) = body.tags.as_deref().filter(|v| !v.is_empty()) {
        binds.push(Value::String(serde_json::to_string(tags).unwrap_or_default()));
        set.push(format!("tags = ${}", binds.len()));
    }

    // `location` = GeoJSON text (postgis).
    if let Some(location) = body.location.as_ref() {
        let geo = serde_json::to_string(location).unwrap_or_default();
        if !geo.is_empty() {
            binds.push(Value::String(geo));
            set.push(format!("location = ${}", binds.len()));
        }
    }

    if set.is_empty() {
        return Err(AppError::BadRequest(
            "Không có trường nào được cung cấp để cập nhật.".to_string(),
        ));
    }

    let sql = format!(
        "UPDATE pins SET {} WHERE id = ${} RETURNING *",
        set.join(", "),
        binds.len() + 1
    );

    let mut query = sqlx::query(&sql);
    for bind in binds {
        query = query.bind(bind);
    }
    query = query.bind(&id);

    let row = query
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    match row {
        Some(row) => Ok(Json(ApiResponse::ok(pin_to_json(&row)))),
        None => Err(AppError::NotFound("Pin không tồn tại.".to_string())),
    }
}

/// `DELETE /api/pins/{id}` — xóa mềm pin (chủ sở hữu hoặc admin).
pub async fn delete_pin(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let row = sqlx::query(DB_SELECT_PIN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::NotFound("Pin không tồn tại.".to_string())),
    };

    let posted_by = row.get::<Option<String>>("posted_by").unwrap_or_default();
    if posted_by != user.id && !is_admin(&user) {
        return Err(AppError::Forbidden(
            "Chỉ chủ sở hữu hoặc admin mới được xóa pin.".to_string(),
        ));
    }

    sqlx::query("UPDATE pins SET deleted_at = NOW() WHERE id = $1")
        .bind(&id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Pin đã bị xóa.",
    }))))
}

/// `optional_user` — read-only access to the `AuthUser` extension (used by the
/// list/detail read paths).
fn optional_user(req: &Request) -> Option<AuthUser> {
    req.extensions().get::<AuthUser>().cloned()
}
