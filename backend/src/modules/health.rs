//! Health + status endpoints.

use crate::common::response::ApiResponse;
use crate::db::pool::{is_healthy, DbPool};
use axum::http::StatusCode;
use axum::extract::State;

/// `/api/health` — public, checked by the proxy (no JWT required).
///
/// The response is the standard JSON envelope with a `Ping` field so the
/// frontend can tell whether the database is reachable.
pub async fn get_health(
    State(pool): State<DbPool>,
) -> impl axum::response::IntoResponse {
    let ok = is_healthy(&pool).await;
    let status = if ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let data = serde_json::json!({ "ping": ok });

    (status, axum::Json(ApiResponse::<serde_json::Value>::ok(data))).into_response()
}

/// `/api/health/db` — the pool status (the connection string works or not).
pub async fn get_db_status(
    State(pool): State<DbPool>,
) -> impl axum::response::IntoResponse {
    let ok = is_healthy(&pool).await;
    let message = if ok { "connected" } else { "error" };
    let status = if ok {
        StatusCode::OK
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    };

    (status, axum::Json(ApiResponse::<&str>::ok(message))).into_response()
}
