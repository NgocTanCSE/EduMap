//! Application error handling.
//!
//! Turned into HTTP codes by `IntoResponse` so every error path results in a
//! `400/401/403/404/500` JSON response — the same contract as the previous
//! NestJS `ExceptionFilter`.
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json;
use std::fmt;



/// The internal error surface (converted to HTTP codes outside of validation).
#[derive(Debug)]
pub enum AppError {
    /// Invalid request payload / query params
    BadRequest(String),

    /// Unauthorised (missing/invalid token)
    Unauthorized(String),
    /// Forbidden (wrong role)
    Forbidden(String),
    /// Not found (resource)
    NotFound(String),
    /// Conflict (duplicate record)
    Conflict(String),
    /// Server (logic) error
    Internal(String),
    /// External service (e.g. the ai-service or a third-party API) is unreachable
    /// — 503 instead of 502 so the frontend can degrade to a template.
    External(String),
    /// Something failed in `io` (network / filesystem / file handle)
    Io(String),
    /// A remote service is unavailable (503)
    ServiceUnavailable(String),
}

impl AppError {
    /// The HTTP code the error maps to.
    pub fn status(&self) -> StatusCode {
        match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,

            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::External(_) => StatusCode::SERVICE_UNAVAILABLE,
            AppError::Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = self.status();
        let body = serde_json::json!({
            "success": false,
            "data": serde_json::Value::Null,
            "message": match self {
                AppError::BadRequest(m) => m,

                AppError::Unauthorized(m) => m,
                AppError::Forbidden(m) => m,
                AppError::NotFound(m) => m,
                AppError::Conflict(m) => m,
                AppError::Internal(m) => m,
                AppError::External(m) => m,
                AppError::Io(m) => m,
                AppError::ServiceUnavailable(m) => m,
            },
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        (status, axum::Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    /// Convert a database error into a `400/403/404/500` response.
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("Không tìm thấy dữ liệu.".to_string()),
            _ => AppError::Internal(format!("Lỗi cơ sở dữ liệu: {}", err)),
        }
    }
}

impl From<uuid::Error> for AppError {
    fn from(err: uuid::Error) -> Self {
        AppError::Internal(format!("Lỗi UUID: {}", err))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::External(format!("Lỗi dịch vụ bên ngoài: {}", err))
    }
}

impl From<std::num::ParseIntError> for AppError {
    fn from(err: std::num::ParseIntError) -> Self {
        AppError::BadRequest(format!("tham số không hợp lệ: {}", err))
    }
}

impl From<std::num::ParseFloatError> for AppError {
    fn from(err: std::num::ParseFloatError) -> Self {
        AppError::BadRequest(format!("tham số không hợp lệ: {}", err))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::BadRequest(format!("dữ liệu không hợp lệ: {}", err))
    }
}

impl From<axum::Error> for AppError {
    fn from(err: axum::Error) -> Self {
        AppError::Internal(format!("Lỗi phản hồi yêu cầu: {}", err))
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized(format!("Token không hợp lệ: {}", err))
    }
}

impl From<String> for AppError {
    fn from(err: String) -> Self {
        AppError::Internal(err)
    }
}

/// Rows are inserted/updated in the `?`-style handler, so each module gets
/// `Behaviour` intact.
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::BadRequest(m) => write!(f, "BadRequest: {m}"),

            AppError::Unauthorized(m) => write!(f, "Unauthorized: {m}"),
            AppError::Forbidden(m) => write!(f, "Forbidden: {m}"),
            AppError::NotFound(m) => write!(f, "NotFound: {m}"),
            AppError::Conflict(m) => write!(f, "Conflict: {m}"),
            AppError::Internal(m) => write!(f, "Internal: {m}"),
            AppError::External(m) => write!(f, "External: {m}"),
            AppError::Io(m) => write!(f, "Io: {m}"),
            AppError::ServiceUnavailable(m) => write!(f, "ServiceUnavailable: {m}"),
        }
    }
}

impl std::error::Error for AppError {}



impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(format!("Lỗi file hệ thống: {err}"))
    }
}

impl From<axum::extract::multipart::MultipartError> for AppError {
    fn from(err: axum::extract::multipart::MultipartError) -> Self {
        AppError::Io(format!("Lỗi tải lên dữ liệu: {err}"))
    }
}

impl From<argon2::password_hash::Error> for AppError {
    /// Argon2 hashing failure (bad hash / secret too long ...)
    fn from(err: argon2::password_hash::Error) -> Self {
        AppError::Internal(format!("Lỗi mật khẩu: {err}"))
    }
}
