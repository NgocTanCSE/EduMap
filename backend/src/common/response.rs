//! Application response envelope — the Axum equivalent of the previous
//! NestJS `ResponseInterceptor`.
//!
//! Every JSON body is wrapped in `{ success, data, message, timestamp }` so
//! the frontend keeps a single shape regardless of which backend is serving.
use serde::{Deserialize, Serialize};
use serde_json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// `true` on success, `false` on error.
    pub success: bool,
    /// The payload (an object, an array or `null`).
    pub data: T,
    /// Human-readable status text — optional on success, required on error.
    pub message: Option<String>,
    /// ISO-8601 stamp of when the response was built.
    pub timestamp: String,
}

impl<T> ApiResponse<T> {
    /// 200-style success envelope.
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data,
            message: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Error envelope (used by the `IntoResponse` impl of `AppError`).
    pub fn err(message: String) -> Self
    where
        T: Default,
    {
        Self {
            success: false,
            data: T::default(),
            message: Some(message),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl<T> Default for ApiResponse<T>
where
    T: Default,
{
    fn default() -> Self {
        Self::ok(T::default())
    }
}