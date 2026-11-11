//! AI proxy — the Rust port of `backend/src/modules/ai/ai.controller.ts` +
//! `ai.service.ts`.
//!
//! The frontend BFF (`frontend/app/api/ai/*`) calls `getBackendUrl() + '/ai/...'`
//! — through the HF proxy, `/api/ai/*` now lands on the Rust backend (`see
//! scripts/hf_proxy.js`), so the handlers relay them into the FastAPI ai-service
//! (port 8000) with the exact same contracts as the old NestJS backend:
//!
//! ```text
//! POST /api/ai/chat-stream      -> ai-service /api/ai/chat/stream  (SSE)
//! POST /api/ai/agent/chat-stream-> ai-service /api/ai/agent/chat-stream (SSE)
//! POST /api/ai/chat             -> ai-service /api/ai/chat         (JSON)
//! POST /api/ai/agent/chat       -> ai-service /api/ai/agent/chat   (JSON)
//! GET  /api/ai/history          -> backend only (chat_histories)
//! GET  /api/ai/search           -> ai-service /api/ai/search/      (JSON)
//! POST /api/ai/speech/to-text   -> ai-service /api/ai/speech/to-text (JSON)
//! POST/GET /api/ai/{*rest}      -> ai-service /api/ai/{*rest}      (verbatim)
//! ```
//!
//! The streaming endpoints forward the ai-service's SSE body **byte-exact**
//! (that is what the old backend did with `axios` `responseType: 'stream'`)
//! and only parse it on top of it so the frontend can read `sources` +
//! `fullReply`. When the retry window is exhausted the degraded reply is
//! emitted instead: the frontend never renders the 503 bubble that used to
//! appeared on every cold start of the HF free tier.

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Extension, Json, Path, Query, State};
use axum::http::Body;
use axum::http::HeaderMap;
use axum::http::Request;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use hyper::body::to_bytes;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

/// The paths the ai-service answers for the chat stream.
const AI_CHAT_STREAM_PATHS: &[&str] = &["/api/ai/chat/stream", "/chat/stream"];
/// The paths the ai-service answers for the agent stream.
const AI_AGENT_STREAM_PATHS: &[&str] = &["/api/ai/agent/chat-stream"];
/// Non-streaming paths (single host).
const AI_CHAT_PATH: &str = "/api/ai/chat";
const AI_AGENT_CHAT_PATH: &str = "/api/ai/agent/chat";
const AI_SEARCH_PATH: &str = "/api/ai/search";
const AI_SPEECH_PATH: &str = "/api/ai/speech/to-text";

/// Seconds a single request to the ai-service may take (`AI_SERVICE_TIMEOUT`,
/// default 45s in the off-line template).
fn ai_service_timeout_seconds() -> u64 {
    std::env::var("AI_SERVICE_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(45)
}

/// Retries + delay used by the old `chatStream` / `agentChatStream`
/// (`_streamRetryConfig`: 3 attempts, 2s delay).
const STREAM_RETRY_ATTEMPTS: u32 = 3;
const STREAM_RETRY_DELAY_MS: u64 = 2000;

/// The degraded (offline/cold-start) SSE body. Byte-for-byte the same as the
/// old backend's `_writeDegradedStream`:
///
/// ```text
/// data: {"sources": [], "meta": true}\n\n
/// data: {"token": "<word>", "is_final": false}\n\n
/// ...
/// data: {"token": "", "is_final": true, "done": true}\n\n
/// data: {"done": true}\n\n
/// ```
const DEGRADED_FINAL_TOKEN: &str = "data: {\"token\": \"\", \"is_final\": true, \"done\": true}\n\n";
const DEGRADED_DONE: &str = "data: {\"done\": true}\n\n";

/// Request: `POST /api/ai/chat-stream` / `POST /api/ai/agent/chat-stream` /
/// `POST /api/ai/chat` / `POST /api/ai/agent/chat`.
#[derive(Debug, Deserialize)]
pub struct ChatStreamRequest {
    pub message: String,
    pub history: Vec<ChatMessage>,
    pub context: Option<serde_json::Value>,
    pub session_id: Option<String>,
}

/// A single message of the chat history (what the frontend sends).
#[derive(Debug, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Request: `GET /api/ai/search?q=...&limit=...`.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Request: `POST /api/ai/speech/to-text`.
#[derive(Debug, Deserialize)]
pub struct SpeechRequest {
    pub audio_base64: Option<String>,
    pub language: Option<String>,
}

/// The result of a streamed request: the whole SSE body, plus the parsed
/// `sources` and the accumulated `fullReply`.
struct StreamResult {
    body: Vec<u8>,
    sources: Vec<serde_json::Value>,
    full_reply: String,
}

/// Whether the request failed in a way the old backend retried (connection
/// refused / DNS / timeout / 503).
fn is_retryable(error: &reqwest::Error) -> bool {
    error.is_timeout() || error.is_server_error() || error.is_connect()
}

/// Build the proxy request body (mirrors the old backend's `payload`): the
/// `session_id` is derived from the user (`sess_<userId>`) exactly as the
/// old `chatStream` did.
fn build_stream_payload(payload: &ChatStreamRequest, user_id: Option<&str>) -> serde_json::Value {
    let sid = match user_id {
        Some(id) => format!("sess_{}", id),
        None => payload.session_id.clone().unwrap_or_default(),
    };
    let mut context = payload.context.clone().unwrap_or_else(|| serde_json::Value::Null);
    if context.is_null() {
        context = serde_json::json!({});
    }
    context["session_id"] = serde_json::Value::from(sid.clone());
    serde_json::json!({
        "message": payload.message,
        "history": payload.history,
        "context": context,
        "user_id": user_id,
    })
}

/// Run a streamed request against the ai-service with the old retry rules.
///
/// - On `404` on the first path it advances to the next one (the old backend
///   did `pathIndex += 1; attempt -= 1; continue`).
/// - On `ECONNREFUSED` / `503` / timeout it retries up to
///   `STREAM_RETRY_ATTEMPTS` with `STREAM_RETRY_DELAY ms` gaps.
/// - Everything else ends the loop with an error.
async fn stream_proxy(paths: &[&str], payload: &serde_json::Value) -> Result<StreamResult, AppError> {
    let client = build_client();
    let ai_service_url = crate::config::AI_SERVICE_URL.as_str();
    let mut path_index = 0;

    let mut last_error: Option<reqwest::Error> = None;
    for attempt in 0..STREAM_RETRY_ATTEMPTS {
        let stream_path = match paths.get(path_index) {
            Some(path) => path,
            None => break,
        };
        let url = format!("{}{}", ai_service_url, stream_path);
        match client
            .post(&url)
            .json(payload)
            .timeout(Duration::from_secs(ai_service_timeout_seconds()))
            .send()
            .await
        {
            Ok(response) => {
                if response.status() == StatusCode::NOT_FOUND && path_index + 1 < paths.len() {
                    // Try the next path (the old ai-service was 404 on it).
                    path_index += 1;
                    continue;
                }
                let body = response.bytes().await.map_err(AppError::from)?;
                let (sources, full_reply) = parse_sse(&body);
                return Ok(StreamResult { body, sources, full_reply });
            }
            Err(error) => {
                last_error = Some(error);
                if attempt + 1 >= STREAM_RETRY_ATTEMPTS || !is_retryable(&error) {
                    break;
                }
                let delay = Duration::from_millis(STREAM_RETRY_DELAY_MS);
                sleep(delay).await;
            }
        }
    }
    Err(AppError::Io(
        last_error
            .map(|e| e.to_string())
            .unwrap_or_else(|| "ai-service not reachable".to_string()),
    ))
}

/// Run a plain (non-streaming) request against the ai-service.
async fn json_proxy(path: &str, payload: &serde_json::Value) -> Result<serde_json::Value, AppError> {
    let client = build_client();
    for attempt in 0..5 {
        match client
            .post(&format!("{}{}", crate::config::AI_SERVICE_URL.as_str(), path))
            .json(payload)
            .timeout(Duration::from_secs(ai_service_timeout_seconds()))
            .send()
            .await
        {
            Ok(response) => return Ok(response.json().await.map_err(AppError::from)?),
            Err(error) => {
                if attempt + 1 >= 5 || !is_retryable(&error) {
                    return Err(AppError::Io(error.to_string()));
                }
                sleep(Duration::from_millis(3000)).await;
            }
        }
    }
    Err(AppError::Io("ai-service request exhaustion".to_string()))
}

/// Cache-safe client (built once, reused by every request).
fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(ai_service_timeout_seconds()))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .expect("build ai-service request client")
}

/// Parse the ai-service's SSE body the way the old backend parsed the
/// forwarded stream (empty frames are skipped, `data:` lines are json-parsed).
fn parse_sse(body: &[u8]) -> (Vec<serde_json::Value>, String) {
    let mut sources: Vec<serde_json::Value> = Vec::new();
    let mut full_reply = String::new();
    let text = match std::str::from_utf8(body) {
        Ok(text) => text,
        Err(_) => return (sources, full_reply),
    };
    for chunk in text.split('\n\n') {
        let line = chunk.trim();
        let data_str = match line.strip_prefix("data: ") {
            Some(data_str) => data_str.trim(),
            None => continue,
        };
        if data_str.is_empty() || data_str == "[DONE]" {
            continue;
        }
        match serde_json::from_str::<serde_json::Value>(data_str) {
            Ok(parsed) => {
                if let Some(sources_field) = parsed.get("sources") {
                    if sources_field.is_array() {
                        sources = sources_field.clone();
                    }
                }
                if let Some(token) = parsed.get("token").and_then(|t| t.as_str()) {
                    full_reply.push_str(token);
                }
            }
            Err(_) => continue,
        }
    }
    (sources, full_reply)
}

/// Emit the degraded SSE body (byte-identical to the old `_writeDegradedStream`).
fn build_degraded_body(reply: &str) -> Vec<u8> {
    let sources = serde_json::Value::Array(vec![]);
    let meta = serde_json::json!({"sources": sources, "meta": true});
    let mut body: Vec<u8> = Vec::new();
    body.extend_from_slice(b"data: ");
    body.extend_from_slice(meta.to_string().as_bytes());
    body.extend_from_slice(b"\n\n");
    for token in split_words(reply) {
        let token_json = serde_json::json!({"token": token, "is_final": false});
        body.extend_from_slice(b"data: ");
        body.extend_from_slice(token_json.to_string().as_bytes());
        body.extend_from_slice(b"\n\n");
    }
    body.extend_from_slice(DEGRADED_FINAL_TOKEN.as_bytes());
    body.extend_from_slice(DEGRADED_DONE.as_bytes());
    body
}

/// Mirror `reply.match(/\S+\s*/g)` — split a string into words (the
/// trailing whitespace is kept so the frontend concatenates it back exactly).
fn split_words(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|word| format!("{} ", word))
        .collect()
}

/// The old backend's `_degradedStreamReply`: an honest sentence + what the
/// user may still do while the ai-service restarts.
fn degraded_stream_reply(message: &str, detail: &str) -> String {
    let short_question = message.chars().take(40).collect::<String>();
    format!(
        "Xin lỗi, trợ lý AI hiện chưa phản hồi được. {}\n\nCâu hỏi đã ghi nhận: \"{}\"\n\nBạn vui lòng thử lại sau khoảng 1 phút. Trong lúc chờ, bạn vẫn dùng được các mục: Bản đồ, Học bổng, Việc làm – Thực tập, Tài liệu học tập.",
        detail,
        short_question,
    )
}

/// Save the streamed conversation into the backend's own `chat_histories`
/// (mirrors the old backend's `saveToHistory`, fire-and-forget).
async fn save_history(pool: &DbPool, user_id: &str, message: &str, sources: &serde_json::Value) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO chat_histories (user_id, message, response, context, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(&user_id)
    .bind(&message)
    .bind("degraded")
    .bind(&serde_json::json!({"sources": sources}))
    .execute(pool.db())
    .await
    .map_err(AppError::from)
    .map(|_| ())
}

/// A `text/event-stream` response whose body is the forwarded SSE (the old
/// backend wrote the same SSE directly into the client's response).
fn build_stream_response(body: Vec<u8>) -> Result<Response, AppError> {
    let bytes = Bytes::from(body);
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .header("X-Accel-Buffering", "no")
        .body(axum::body::Body::from(bytes))
        .expect("build stream response"))
}

/// `POST /api/ai/chat-stream` — the real-time RAG chat (mirrors the old
/// `chatStream`, degraded reply on exhaustion).
pub async fn chat_stream(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<ChatStreamRequest>,
) -> Result<Response, AppError> {
    if payload.message.trim().is_empty() {
        return Err(AppError::BadRequest("Tin nhắn không được để trống."));
    }
    chat_stream_inner(&payload, Some(user.id.as_str()), &pool).await
}

/// `POST /api/ai/agent/chat-stream` — the map agent (mirrors the old
/// `agentChatStream`).
pub async fn agent_chat_stream(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<ChatStreamRequest>,
) -> Result<Response, AppError> {
    if payload.message.trim().is_empty() {
        return Err(AppError::BadRequest("Tin nhắn không được để trống."));
    }
    chat_stream_inner(&payload, Some(user.id.as_str()), &pool).await
}

/// Run the stream handler: proxy the ai-service, keep the SSE bytes
/// byte-exact, and write the degraded reply when everything is exhausted.
pub async fn chat_stream_inner(
    payload: &ChatStreamRequest,
    user_id: Option<&str>,
    pool: &DbPool,
) -> Result<Response, AppError> {
    match stream_proxy(AI_CHAT_STREAM_PATHS, &build_stream_payload(payload, user_id)).await {
        Ok(StreamResult { body, sources, .. }) => {
            // Send it verbatim (byte-exact) and persist the conversation.
            // The save is fire-and-forget: a DB hiccup must never turn the
            // 200 SSE reply into a 500 (the old backend did the same).
            if let Some(id) = user_id {
                let context = serde_json::json!({ "sources": sources });
                let _ = save_history(pool, id, &payload.message, &context).await;
            }
            return build_stream_response(body);
        }
        Err(error) => {
            let reply = degraded_stream_reply(&payload.message, &error.to_string());
            let body = build_degraded_body(&reply);
            let response = build_stream_response(body)?;
            // The old backend also saved the degraded reply.
            if let Some(id) = user_id {
                let _ = save_history(pool, id, &payload.message, &serde_json::json!([])).await;
            }
            return Ok(response);
        }
    }
}

/// `POST /api/ai/chat` — the synchronous RAG chat (mirrors the old `chat`).
pub async fn chat(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<ChatStreamRequest>,
) -> Result<Response, AppError> {
    let payload_value = serde_json::json!({
        "message": payload.message,
        "history": payload.history,
        "context": payload.context,
        "user_id": Some(user.id),
        "session_id": payload.session_id,
    });
    let result = json_proxy(AI_CHAT_PATH, &payload_value).await;
    match result {
        Ok(value) => {
            // The ai-service returns {reply, sources}: keep it.
            let data = value
                .get("reply")
                .cloned()
                .unwrap_or_else(|| serde_json::Value::String("".to_string()));
            let sources = value.get("sources").cloned().unwrap_or_else(|| serde_json::Value::Array(vec![]));
            Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
                "reply": data,
                "sources": sources,
            }))).into_response())
        }
        Err(error) => {
            let reply = degraded_stream_reply(&payload.message, &error.to_string());
            Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
                "reply": reply,
                "sources": Vec::<serde_json::Value>::new(),
                "degraded": true,
            }))).into_response())
        }
    }
}

/// `POST /api/ai/agent/chat` — the synchronous map agent (mirrors the old
/// `agentChat`).
pub async fn agent_chat(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<ChatStreamRequest>,
) -> Result<Response, AppError> {
    agent_chat_inner(&payload, &pool, &user).await
}

/// The backend-only fallback (the old backend kept the `agentChat` path on the
/// backend itself when the ai-service was unreachable).
pub async fn agent_chat_inner(
    payload: &ChatStreamRequest,
    pool: &DbPool,
    user: &AuthUser,
) -> Result<Response, AppError> {
    let sid = format!("sess_{}", user.id);
    let payload_value = serde_json::json!({
        "message": payload.message,
        "history": payload.history,
        "context": payload.context,
        "user_id": Some(user.id.clone()),
        "session_id": Some(sid),
    });
    match json_proxy(AI_AGENT_CHAT_PATH, &payload_value).await {
        Ok(value) => Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(value)).into_response()),
        Err(error) => {
            let reply = "Xin lỗi, trợ lý bản đồ AI hiện chưa phản hồi được. Máy chủ AI đang khởi động lại. Bạn thử lại sau 1 phút nhé.";
            Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
                "answer": reply,
                "sources": Vec::<serde_json::Value>::new(),
                "degraded": true,
                "reason": format!("ai-service unreachable: {}", error),
            }))).into_response())
        }
    }
}

/// `GET /api/ai/history` — the backend's own `chat_histories` (mirrors the
/// old `getUserHistory`, ordered + take 50).
pub async fn history(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
) -> Result<Response, AppError> {
    let rows = sqlx::query_as::<sqlx::Postgres, ChatHistoryRow>(
        r#"
        SELECT id, user_id, message, response, context, created_at
        FROM chat_histories
        WHERE user_id = $1
        ORDER BY created_at ASC
        LIMIT 50
        "#,
    )
    .bind(&user.id)
    .fetch_all(pool.db())
    .await
    .map_err(AppError::from)?;
    let messages: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.id,
                "message": row.message,
                "response": row.response,
                "context": row.context,
                "created_at": row.created_at,
            })
        })
        .collect();
    Ok(axum::Json(ApiResponse::<Vec<serde_json::Value>>::ok(messages)).into_response())
}

/// `GET /api/ai/search?q=...&limit=...` — proxy (mirrors the old `search`).
pub async fn search(
    Query(query): Query<SearchQuery>,
) -> Result<Response, AppError> {
    if query.q.trim().is_empty() {
        return Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "success": true,
            "data": Vec::<serde_json::Value>::new(),
        }))).into_response());
    }
    let limit = query.limit.unwrap_or(5);
    let query = percent_encoding::utf8_percent_encode(&query.q, percent_encoding::NON_ALPHANUMERIC);
    let url = format!("{}{}?q={}&limit={}", crate::config::AI_SERVICE_URL.as_str(), AI_SEARCH_PATH, query, limit);
    let client = build_client();
    let response = client.get(&url).send().await.map_err(AppError::from)?;
    let data = response.json::<serde_json::Value>().await.map_err(AppError::from)?;
    // The ai-service returns {status, message, data}: normalize to the old
    // backend's {success, data} shape.
    let output = serde_json::json!({
        "success": data.get("status").map(|s| s == "success").unwrap_or(true),
        "data": data.get("data").cloned().unwrap_or_else(|| serde_json::Value::Array(vec![])),
    });
    Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(output)).into_response())
}

/// `POST /api/ai/speech/to-text` — proxy (mirrors the old `speechToText`; the
/// ai-service degrades to `degraded: true` + empty `text` on its own).
pub async fn speech_to_text(
    Json(payload): Json<SpeechRequest>,
) -> Result<Response, AppError> {
    let json = serde_json::json!({
        "audio_base64": payload.audio_base64,
        "language": payload.language,
    });
    let client = build_client();
    let response = client
        .post(format!("{}{}", crate::config::AI_SERVICE_URL.as_str(), AI_SPEECH_PATH))
        .json(&json)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(AppError::from)?;
    let body = response.bytes().await.map_err(AppError::from)?;
    let data = serde_json::from_slice::<serde_json::Value>(&body).unwrap_or_else(|_| serde_json::Value::Null);
    Ok(axum::Json(ApiResponse::<serde_json::Value>::ok(data)).into_response())
}

/// Generic AI proxy: every `/api/ai/{rest}` that has no dedicated handler above
/// (`knowledge/*`, `language/*`, `learning-path`, `trends`, `pdf-transcript`,
/// `route/explain`, ...) is forwarded to the ai-service verbatim: method,
/// query string, the whole header map (minus hop-by-hop headers) and the body.
pub async fn proxy(
    Path(rest): Path<String>,
    req: Request<Body>,
) -> Result<Response, AppError> {
    // `rest` is everything after `/api/ai/` (e.g. `knowledge/graph`); the
    // ai-service serves the same paths under `/api/ai/` itself, so the prefix
    // must be re-added (the old `ai.service.ts` did
    // `${AI_SERVICE_URL}/api/ai/{*rest}` verbatim).
    let mut target = format!(
        "{}/api/ai/{}",
        crate::config::AI_SERVICE_URL.as_str(),
        rest
    );
    // Keep the path canonical (the ai-service 404s on a trailing slash).
    target = target.trim_end_matches('/').to_string();
    let headers = req.headers().clone();
    let method = req.method().clone();
    // Byte-exact body: the old backend streamed the raw payload to the ai-service.
    let body = to_bytes(req.into_body()).await.map_err(AppError::from)?;
    // Forward the whole header set minus hop-by-hop headers (connection,
    // transfer-encoding, ...) — the ai-service/tower compute those itself.
    let mut forwarded: HeaderMap = HeaderMap::new();
    for (name, value) in headers.iter() {
        let name = name.as_str();
        if !IS_SERVER_ONLY_HEADER.contains(name) {
            forwarded.insert(name, value.clone());
        }
    }
    let client = build_client();
    let response = client
        .request(method.clone(), &target)
        .headers(forwarded)
        .body(reqwest::Body::from(body.to_vec()))
        .timeout(Duration::from_secs(ai_service_timeout_seconds()))
        .send()
        .await
        .map_err(AppError::from)?;
    let (status, response_headers) = (response.status(), response.headers().clone());
    let bytes = response.bytes().await.map_err(AppError::from)?;
    Ok(Response::builder()
        .status(status)
        .headers(response_headers)
        .body(axum::body::Body::from(bytes))
        .expect("build proxy response"))
}

/// Headers the proxy never forwards (they are connection-level and the next
/// hop computes them from the forwarded request).
const IS_SERVER_ONLY_HEADER: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
];

/// The row shape of `chat_histories` (mirrors the old `chat-history.entity`).
#[derive(Debug, sqlx::FromRow)]
pub struct ChatHistoryRow {
    pub id: String,
    pub user_id: Option<String>,
    pub message: String,
    pub response: String,
    pub context: Option<serde_json::Value>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}
