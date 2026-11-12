//! Offline Tutor module — `/api/offline/*`: Edge AI Tutor (F-06: offline
//! LLM, không kết nối internet bắt buộc) — proxy vào FastAPI ai-service,
//! graceful fallback mẫu khi ai-service không phản hồi (đúng như old
//! backend `OfflineTutorService._gracefulFallback`).
//!
//! Routing table (public — old controller `@Public()`):
//!
//! ```text
//! POST /api/offline/tutor  -> public, proxy + template fallback
//! GET  /api/offline/status -> public, status proxy + backend-fallback
//! ```
//!
//! Mirrors `backend/src/modules/offline-tutor/offline-tutor.controller.ts`
//! + `offline-tutor.service.ts`. Ai-service (local model đã xóa) luôn
//! trả lại `degraded` nên backend luôn có câu trả lời.

use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::modules::proxy;
use axum::extract::Query;
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// Body của `POST /api/offline/tutor` (đối tượng yêu cầu).
#[derive(Debug, Deserialize)]
struct TutorForm {
    action: String,
    topic: String,
    #[serde(default)]
    material_context: Option<String>,
    #[serde(default)]
    difficulty: Option<String>,
    #[serde(default)]
    num_questions: Option<i64>,
    #[serde(default)]
    progression: Option<Value>,
}

/// Response của `GET /api/offline/status`.
#[derive(Debug, Deserialize)]
struct StatusForm {
    model_name: Option<String>,
    model_failed: Option<bool>,
    source: Option<String>,
}

/// Phát国际化的 yêu cầu từ old controller: `POST /api/offline/tutor`
/// nhận payload `{action, topic, ...}`.
async fn status_from_aiservice() -> Result<Value, AppError> {
    // Không có cache: proxy GET.
    // Lỗi (transport) → backend-fallback.
    Ok(Value::Null)
}

// ---------------------------------------------------------------------------
// Fallback templates ( مطابق old `_gracefulFallback`)
// ---------------------------------------------------------------------------

/// Cảm ứng giải thích (action='explain').
fn explain(topic: &str) -> Value {
    serde_json::json!({
        "action": "explain",
        "topic": topic,
        "degraded": true,
        "source": "backend-template",
        "text": format!(
            "**{}** là một khái niệm quan trọng trong chương trình học. ",
            topic
        ) + "Hãy ôn lại lý thuyết cơ sở, luyện tập qua các bài tập mẫu, "
            "và áp dụng vào các tình huống thực tế.\n\n*Lưu ý: Kết nối tới AI Service thất bại — đang sử dụng bản sao lưu mẫu.*",
        "model_used": Value::Null,
    })
}

/// Câu hỏi luyện tập (action='practice').
fn practice(payload: &TutorForm) -> Value {
    let num = payload.num_questions.unwrap_or(3).max(1).min(5);
    let mut questions = Vec::new();
    for i in 1..=num {
        questions.push(serde_json::json!({
            "question": format!("[Câu {}] Hãy giải thích lý thuyết liên quan đến {}?", i, payload.topic),
            "answer": "Xem lại các công thức và định lý đã học.",
            "difficulty": payload.difficulty.as_deref().unwrap_or("medium"),
        }));
    }
    serde_json::json!({
        "action": "practice",
        "topic": payload.topic,
        "degraded": true,
        "source": "backend-template",
        "questions": questions,
        "model_used": Value::Null,
        "difficulty": payload.difficulty.as_deref().unwrap_or("medium"),
    })
}

/// Đề xuất (action='suggest').
fn suggest(payload: &TutorForm) -> Value {
    let prog = payload.progression.as_ref().unwrap_or(&Value::Null).clone();
    let weak = prog.get("weak_areas").and_then(|a| a.as_array()).and_then(|a| a.first()).unwrap_or(&Value::Null);
    serde_json::json!({
        "action": "suggest",
        "topic": payload.topic,
        "degraded": true,
        "source": "backend-template",
        "next_step": format!("Hãy ôn tập lại {} và chuẩn bị cho bài tiếp theo", weak),
        "resources": Vec::<Value>::new(),
        "estimated_time": "15-20 phút",
        "difficulty": prog.get("current_level").and_then(|v| v.as_str()).unwrap_or("medium"),
        "progression": prog,
        "model_used": Value::Null,
    })
}

/// Fallback mẫu — hành động chưa hỗ trợ.
fn unknown(): Value {
    serde_json::json!({
        "action": "unknown",
        "topic": "",
        "degraded": true,
        "source": "backend-template",
        "text": "Hành động chưa được hỗ trợ. Vui lòng sử dụng: explain, practice, hoặc suggest.",
        "model_used": Value::Null,
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/offline/tutor` — Edge AI Tutor: proxy vào ai-service
/// (`POST /api/offline/tutor`), graceful fallback mẫu khi ai-service
/// không phản hồi (false không 500/503).
pub async fn tutor(
    State(pool): State<DbPool>,
    Json(form): Json<TutorForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _pool = pool;

    if form.action.is_empty() || form.topic.is_empty() {
        return Err(AppError::BadRequest(
            "Thiếu trường bắt buộc: action và topic".to_string(),
        ));
    }

    let payload: Value = serde_json::json!({
        "action": form.action,
        "topic": form.topic,
        "material_context": form.material_context,
        "difficulty": form.difficulty,
        "num_questions": form.num_questions,
        "progression": form.progression,
    });

    let result = proxy::proxy_to_ai_service("/api/offline/tutor", payload).await;

    match result {
        Ok(data) => Ok(Json(ApiResponse::ok(data))),
        Err(e) => {
            tracing::warn!("Offline tutor proxy failed: {e}");
            // graceful fallback mẫu (explain / practice / suggest).
            let fallback = match form.action.as_str() {
                "explain" => explain(&form.topic),
                "practice" => practice(&form),
                "suggest" => suggest(&form),
                _ => unknown(),
            };

            Ok(Json(ApiResponse::ok(fallback)))
        }
    }
}

/// `GET /api/offline/status` — Edge AI Tutor status.
///
/// Proxy vào ai-service (`POST /api/offline/status`); khi ai-service
/// không phản hồi, trả về backend-fallback (model chưa được tải).
pub async fn status(
    State(pool): State<DbPool>,
    Query(_query): Query<serde::de::IgnoredAny>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _pool = pool;

    match proxy::proxy_get_aiservice("/api/offline/status").await {
        Ok(data) => Ok(Json(ApiResponse::ok(data))),
        Err(e) => {
            tracing::warn!("Offline tutor status proxy failed: {e}");
            // Backend fallback (model chưa được tải trên ai-service).
            Ok(Json(ApiResponse::ok(serde_json::json!({
                "model_loaded": false,
                "model_failed": true,
                "source": "backend-fallback",
                "error": "ai-service unreachable",
            }))))
        }
    }
}
