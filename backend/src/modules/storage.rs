//! Storage module — `/api/storage/*`: tải lên, phục vụ (public) và xóa tập
//! tin (avatar, CV, ảnh minh chứng, tài liệu...).
//!
//! Mirrors `backend/src/modules/storage/storage.controller.ts` +
//! `storage.service.ts`.
//!   * `GET    /api/storage/my-files`          — danh sách file của người dùng (JWT)
//!   * `POST   /api/storage/upload`           — tải lên file (JWT)
//!   * `GET    /api/storage/media/:objectName` — phục vụ file tĩnh (public)
//!   * `DELETE /api/storage/:id`              — xóa file khỏi DB và filesystem (JWT)
//!
//! Old backend dùng MinIO (S3); HF free tier không có S3, nên file được ghi
//! xuống `STORAGE_DIR` (env, mặc định `/app/uploads`) qua `fs` và phục vụ lại
//! từ filesystem. `file_url` luôn là `/api/storage/media/<objectName>` để
//! route công cộng này phục vụ chúng.
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị
//! cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Multipart, Path};
use axum::http::header::{CONTENT_LENGTH, CONTENT_TYPE};
use axum::http::{Response, StatusCode};
use axum::Json;
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::path::{Path as Fp, PathBuf};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: `/api/storage/media` (public) không nhận
/// `AuthUser` từ router, các handler write phải tự kiểm và trả `401` khi JWT
/// thiếu.
fn authenticated_user(req: &axum::http::Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/// Thư mục chứa các file đã tải lên (mặc định `/app/uploads`, giống old
/// backend `process.env.STORAGE_DIR || cwd/uploads`).
static STORAGE_DIR: Lazy<String> =
    Lazy::new(|| env_var_or("STORAGE_DIR", "/app/uploads"));

fn env_var_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// Extension → `Content-Type` (giống `mimeTypes` của old controller).
fn content_type(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "json" => "application/json",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "html" | "htm" => "text/html",
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        "zip" => "application/zip",
        "rar" => "application/x-rar-compressed",
        _ => "application/octet-stream",
    }
}

/// Cắt bỏ các ký tự không hợp lệ khỏi `objectName` (an toàn, tránh `../`).
fn safe_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Thời gian hiện tại (Unix ms), dùng làm prefix của `objectName` — tên file
/// không bao giờ trùng.
fn timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis()
        .to_string()
}

/// File của một user — dùng cho danh sách `my-files`.
#[derive(Deserialize)]
struct MyFile {
    id: String,
    user_id: String,
    original_name: String,
    file_url: String,
    mime_type: String,
    size_kb: f64,
    created_at: String,
}

impl MyFile {
    fn to_json(&self) -> Value {
        serde_json::json!({
            "id": self.id,
            "user_id": self.user_id,
            "original_name": self.original_name,
            "file_url": self.file_url,
            "mime_type": self.mime_type,
            "size_kb": self.size_kb,
            "created_at": self.created_at,
        })
    }

    fn from_row(row: &sqlx::Row) -> Self {
        Self {
            id: row.get::<Option<String>>("id").unwrap_or_default(),
            user_id: row.get::<Option<String>>("user_id").unwrap_or_default(),
            original_name: row.get::<Option<String>>("original_name").unwrap_or_default(),
            file_url: row.get::<Option<String>>("file_url").unwrap_or_default(),
            mime_type: row.get::<Option<String>>("mime_type").unwrap_or_default(),
            size_kb: row.get::<Option<f64>>("size_kb").unwrap_or(0.0),
            created_at: row.get::<Option<String>>("created_at").unwrap_or_default(),
        }
    }
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_MY_FILES: &str = r#"
    SELECT "id", "user_id", "original_name", "file_url", "mime_type",
           "size_kb", CAST("created_at" AS TEXT) AS "created_at"
    FROM "user_files"
    WHERE "user_id" = $1
    ORDER BY "created_at" DESC
"#;

const DB_USER_FILE_BY_ID: &str = r#"
    SELECT "id", "user_id", "original_name", "file_url", "mime_type",
           "size_kb", CAST("created_at" AS TEXT) AS "created_at"
    FROM "user_files"
    WHERE "id" = $1
"#;

const DB_INSERT_FILE: &str = r#"
    INSERT INTO "user_files" ("user_id", "original_name", "file_url",
                              "mime_type", "size_kb")
    VALUES ($1, $2, $3, $4, $5)
    RETURNING "id", "original_name", "file_url", "mime_type", "size_kb",
              CAST("created_at" AS TEXT) AS "created_at"
"#;

const DB_DELETE_FILE: &str = r#"
    DELETE FROM "user_files" WHERE "id" = $1
"#;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/storage/my-files` — danh sách các tập tin đã tải lên của người
/// dùng (JWT).
pub async fn get_my_files(
    State(pool): State<DbPool>,
    req: axum::http::Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_MY_FILES)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;

    let files: Vec<Value> = rows
        .into_iter()
        .map(|r| MyFile::from_row(&r).to_json())
        .collect();

    Ok(Json(ApiResponse::ok(files)))
}

/// `POST /api/storage/upload` — tải lên một tập tin (multipart) và ghi nhận
/// lời nó vào `user_files`. Trả về thông tin file vừa upload (JWT).
pub async fn upload_file(
    State(pool): State<DbPool>,
    req: axum::http::Request,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // Đọc trường `file` từ stream multipart (mirrors old `FileInterceptor`).
    let mut data: Vec<u8> = Vec::new();
    let mut original_name = String::from("file");
    let mut mime_type = String::from("application/octet-stream");
    while let Some(field) = multipart.next_field().await.map_err(AppError::from)? {
        if let Some(name) = field.file_name() {
            original_name = safe_name(&name);
        }
        if let Some(mime) = field.mime_type() {
            mime_type = mime.to_string();
        }
        while let Some(chunk) = field.chunk().await.map_err(AppError::from)? {
            data.extend_from_slice(&chunk);
        }
    }

    if data.is_empty() {
        return Err(AppError::BadRequest(
            "Chưa có tập tin nào được tải lên.".to_string(),
        ));
    }

    let object_name = format!("{}-{}", timestamp(), safe_name(&original_name));
    let file_url = format!("/api/storage/media/{}", object_name);
    let size_kb = (data.len() as f64 / 1024.0).round();

    // Ghi file xuống `STORAGE_DIR` (filesystem thay thế MinIO).
    let dir = PathBuf::from(STORAGE_DIR.as_str());
    fs::create_dir_all(&dir).map_err(|e| {
        AppError::Internal(format!("không thể tạo thư mục upload: {}", e))
    })?;
    let file_path = dir.join(&object_name);
    fs::write(&file_path, &data).map_err(AppError::from)?;

    let created = sqlx::query(DB_INSERT_FILE)
        .bind(&user.id)
        .bind(&original_name)
        .bind(&file_url)
        .bind(&mime_type)
        .bind(&size_kb)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    let file = MyFile::from_row(&created);
    Ok(Json(ApiResponse::ok(file.to_json())))
}

/// `GET /api/storage/media/:objectName` — phục vụ file tĩnh (avatar, CV, ảnh
/// minh chứng...). Public, không cần JWT.
///
/// Old backend đọc file xuống MinIO theo `objectName`; `STORAGE_DIR` thay thế
/// MinIO nên trình phục vụ đọc file thẳng từ đĩa và `404` khi tập tin không
/// tồn tại (cùng một tiến trình xóa: `delete_file` xóa DB + đĩa).
pub async fn serve_media(
    Path(object_name): Path<String>,
) -> Result<Response, AppError> {
    let safe = safe_name(&object_name);

    // Đọc file khỏi `STORAGE_DIR` (MinIO local: filesystem thay thế).
    let path = PathBuf::from(STORAGE_DIR.as_str()).join(&safe);
    let bytes = match fs::read(&path) {
        Ok(data) => data,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                return Ok(StatusCode::NOT_FOUND.into_response());
            }
            return Err(AppError::from(e));
        }
    };

    // Tiêu đề trình phục vụ giữ nguyên như old backend (MinIO).
    let ext = safe
        .split('.')
        .next_back()
        .unwrap_or("")
        .to_lowercase();

    let mut response = Response::builder().status(StatusCode::OK);
    if let Ok(len) = axum::http::HeaderValue::from_str(&bytes.len().to_string()) {
        response = response.header(CONTENT_LENGTH, len);
    }
    let response = response
        .header(CONTENT_TYPE, axum::http::HeaderValue::from_static(content_type(&ext)))
        .body(Body::from(bytes))
        .expect("build media response");

    Ok(response)
}

/// `DELETE /api/storage/:id` — xóa tập tin khỏi DB và xóa file khỏi
/// `STORAGE_DIR`. Chủ sở hữu kiểm theo `user_id` (JWT).
pub async fn delete_file(
    State(pool): State<DbPool>,
    req: axum::http::Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let user_file = sqlx::query(DB_USER_FILE_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let user_file = match user_file {
        Some(r) => r,
        None => return Err(AppError::NotFound("Không tìm thấy tập tin".to_string())),
    };

    if user_file.get::<String>("user_id") != user.id {
        return Err(AppError::Forbidden(
            "Bạn không có quyền xóa tập tin này".to_string(),
        ));
    }

    let file_url = user_file.get::<Option<String>>("file_url").unwrap_or_default();
    let object_name = file_url.rsplit('/').last().unwrap_or(&id);
    let file_path = PathBuf::from(STORAGE_DIR.as_str()).join(safe_name(object_name));
    if fs::remove_file(&file_path).is_err() {
        // Đừng chặn xóa khi file không còn (đã bị xóa từ trước).
        tracing::debug!(path = ?file_path, "không tìm thấy file, bỏ qua xóa trên đĩa");
    }

    sqlx::query(DB_DELETE_FILE)
        .bind(&id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Đã xóa tập tin.",
    }))))
}
