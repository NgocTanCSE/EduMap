//! Blockchain module — `/api/blockchain/*`: ký số (issue) và xác thực
//! (verify) chứng chỉ chuỗi trên lớp mặt chain demo.
//!
//! Routing table (`PUBLIC_PATHS` — `/api/blockchain/verify` là công khai,
//! `/api/blockchain/issue` cần JWT):
//!
//! ```text
//! POST /api/blockchain/issue           -> JWT, ký chứng chỉ
//! GET  /api/blockchain/verify/:code    -> public, xác thực hash chứng chỉ
//! ```
//!
//! Mirrors `backend/src/modules/blockchain/blockchain.controller.ts` +
//! `blockchain.service.ts` (pure hash demo, no DB write).
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị
//! cấm). Postgres-only.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::Request<Body>;
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập (route `issue` yêu cầu JWT).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NETWORK: &str = "Polygon PoS (EduMap Layer 2)";
const CONTRACT: &str = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const CONFIRMATIONS: i64 = 128;

/// Thời gian hiện tại (ms), giống `Date.now()` của old backend.
fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// ISO 8601, giống `new Date().toISOString()` của old backend.
fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// Request của `POST /api/blockchain/issue`.
#[derive(Debug, Deserialize)]
struct IssueForm {
    user_id: String,
    cert_code: String,
    template_name: String,
}

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

/// Ký chứng chỉ (mô phỏng) — trả về metadata blockchain.
///
/// `data_to_sign = "<userId>:<certCode>:<templateName>:<ts>"` — giống
/// `crypto.createHash('sha256').update(dataToSign).digest('hex')` của old
/// service. `tx_hash` là `0x` + 64 hex chars, `block_height` là phần demo.
pub fn sign_certificate(user_id: &str, cert_code: &str, template_name: &str) -> Value {
    let data_to_sign = format!("{}:{}:{}:{}", user_id, cert_code, template_name, now_ts());

    let hash = Sha256::digest(data_to_sign.as_bytes());
    let tx_hash = format!("0x{:x}", hash);

    serde_json::json!({
        "network": NETWORK,
        "contract_address": CONTRACT,
        "tx_hash": tx_hash,
        "block_height": (now_ts() / 1000) as i64 - 200_000_000,
        "timestamp": now_iso(),
        "status": "CONFIRMED",
        "demo": true,
        "explorer_url": format!("https://polygonscan.com/tx/{}", tx_hash),
    })
}

/// Xác thực hash chứng chỉ — `0x` + 64 hex chars = hợp lệ (demo).
pub fn verify_hash(tx_hash: &str) -> Value {
    let is_valid = tx_hash.starts_with("0x") && tx_hash.len() == 66;

    serde_json::json!({
        "is_valid": is_valid,
        "network": NETWORK,
        "confirmations": CONFIRMATIONS,
        "demo": true,
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/blockchain/issue` — ký số chứng chỉ (JWT).
///
/// Body: `{ "userId": "...", "certCode": "...", "templateName": "..." }`.
pub async fn issue_certificate(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<IssueForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(&req)?;
    let _pool = pool;

    if body.user_id.is_empty() || body.cert_code.is_empty() || body.template_name.is_empty() {
        return Err(AppError::BadRequest(
            "Thiếu thông tin cần thiết (userId, certCode, templateName).".to_string(),
        ));
    }

    let metadata = sign_certificate(&body.user_id, &body.cert_code, &body.template_name);
    Ok(Json(ApiResponse::ok(metadata)))
}

/// `GET /api/blockchain/verify/:code` — xác thực hash chứng chỉ (public).
///
/// `code` là một `tx_hash` (0x + 64 hex); hãy hiển thị `details.blockchain`.
pub async fn verify(
    State(pool): State<DbPool>,
    Path(code): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _pool = pool;
    let hash = verify_hash(&code);

    Ok(Json(ApiResponse::ok(hash)))
}
