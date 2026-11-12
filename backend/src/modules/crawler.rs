//! Crawler module — `/api/crawler/*`: quy trình crawl WiFi, trường học,
//! không gian xanh và sách (OpenLibrary) vào DB.
//!
//! Mirrors `backend/src/modules/crawler/crawler.controller.ts` +
//! `crawler.service.ts`. Tất cả endpoint là admin/moderator (class-level
//! `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN, MODERATOR)` ở old
//! backend) — self-check qua `authenticated_user` + `ensure_admin`.
//!
//! Trạng thái (`isRunning`, `history`) được giữ trong bộ nhớ (giống old service
//! `this.crawlStatus` / `this.crawlHistory`) và đồng bộ vào bảng `crawl_history`
//! để không mất sau khi khởi động lại.

use crate::common::auth::{ensure_admin, authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Query, State};
use axum::http::Request;
use axum::Json;
use once_cell::sync::OnceLock;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct TriggerBody {
    pub type_: String,
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EmptyQuery {}

// ---------------------------------------------------------------------------
// In-memory state (giống `this.crawlStatus` / `this.crawlHistory` cũ)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CrawlStatus {
    pub is_running: bool,
    pub current_type: Option<String>,
    pub start_time: Option<String>,
    pub last_completed: Option<String>,
    pub total_crawled: i64,
    pub errors: i64,
}

#[derive(Debug, Clone)]
pub struct CrawlHistoryEntry {
    pub id: String,
    pub type_: String,
    pub status: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub records_added: i64,
    pub errors: i64,
    pub message: String,
}

#[derive(Debug, Default)]
struct CrawlState {
    status: CrawlStatus,
    history: Vec<CrawlHistoryEntry>,
}

static CRAWL_STATE: OnceLock<Arc<Mutex<CrawlState>>> = OnceLock::new();

fn state() -> Arc<Mutex<CrawlState>> {
    CRAWL_STATE
        .get_or_init(|| {
            Arc::new(Mutex::new(CrawlState {
                status: CrawlStatus {
                    is_running: false,
                    current_type: None,
                    start_time: None,
                    last_completed: None,
                    total_crawled: 0,
                    errors: 0,
                },
                history: Vec::new(),
            }))
        })
        .clone()
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// ---------------------------------------------------------------------------
// Crawl type whitelist
// ---------------------------------------------------------------------------

const VALID_CRAWL_TYPES: &[&str] = &["map", "wifi", "schools", "books", "green_spaces", "all"];

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_INSERT_CRAWL_HISTORY: &str = r#"
INSERT INTO crawl_history (crawl_type, status, records_added, records_updated,
    records_deleted, errors, error_message, duration_seconds, triggered_by,
    is_automatic, started_at, completed_at)
VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $7, $8, $9, $10)
RETURNING id
"#;

const DB_UPDATE_CRAWL_HISTORY: &str = r#"
UPDATE crawl_history SET status = $2, records_added = $3, errors = $4,
    error_message = $5, completed_at = $6
WHERE id = $1
"#;

const DB_HISTORY_ALL: &str = r#"
SELECT id, crawl_type AS type, status, records_added, errors, error_message AS message,
       CAST(started_at AS TEXT) AS start_time,
       CAST(completed_at AS TEXT) AS end_time
FROM crawl_history ORDER BY started_at DESC LIMIT 200
"#;


const DB_LEARNING_MATERIAL_EXISTS: &str = r#"
SELECT id FROM learning_materials WHERE title = $1 LIMIT 1
"#;

const DB_LEARNING_MATERIAL_INSERT: &str = r#"
INSERT INTO learning_materials (title, description, type, subject, thumbnail_url,
    file_url, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
RETURNING id
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn client() -> Client {
    static C: OnceLock<Client> = OnceLock::new();
    C.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .user_agent("EduMap-Crawler/1.0")
            .build()
            .expect("build crawler client")
    })
    .clone()
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn param_f64(v: &Value, key: &str, default: f64) -> f64 {
    v.get(key)
        .and_then(|x| x.as_f64())
        .unwrap_or(default)
}

fn param_str(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(|s| s.to_string())
}

// ---------------------------------------------------------------------------
// Crawling
// ---------------------------------------------------------------------------

struct CrawlResult {
    success: bool,
    added: i64,
    message: String,
}

/// HTTP GET (dùng cho OpenLibrary, book crawl).
async fn http_get(client: &Client, url: &str) -> Result<Value, String> {
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}", status));
    }
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Crawling (POI đã crawl vào DB -- chỉ còn OpenLibrary sách)
// ---------------------------------------------------------------------------

/// Crawl rỗng: POI đã crawl vào DB, chỉ để báo cáo lịch sử.
async fn crawl_no_op(_client: &Client, _pool: &DbPool) -> CrawlResult {
    CrawlResult {
        success: true,
        added: 0,
        message: "Crawl thu hồi — POI đã crawl trong DB".to_string(),
    }
}

async fn crawl_books(client: &Client, pool: &DbPool, keyword: String, limit: i64) -> Result<CrawlResult, String> {
    let url = format!(
        "https://openlibrary.org/search.json?q={}&limit={}",
        percent_encoding::utf8_percent_encode(&keyword, percent_encoding::QUERY_COMPONENT_ENCODE_SET),
        limit
    );
    let body = http_get(client, &url).await.map_err(|e| format!("OpenLibrary error: {e}"))?;
    let docs = body.get("docs").and_then(|d| d.as_array()).cloned().unwrap_or_default();
    let mut added = 0;
    for doc in docs {
        let title = doc.get("title").and_then(|x| x.as_str()).unwrap_or("");
        if title.is_empty() {
            continue;
        }
        let exists = sqlx::query(DB_LEARNING_MATERIAL_EXISTS)
            .bind(title)
            .fetch_optional(pool.db())
            .await
            .map_err(|e| e.to_string())?;
        if exists.is_some() {
            continue;
        }
        let author = doc.get("author_name")
            .and_then(|a| a.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join(", "))
            .unwrap_or_else(|| "Unknown".to_string());
        let year = doc.get("first_publish_year").and_then(|x| x.as_i64());
        let cover = doc.get("cover_i").and_then(|x| x.as_i64())
            .map(|i| format!("https://covers.openlibrary.org/b/id/{i}-M.jpg"));
        let ol_url = doc.get("key").and_then(|x| x.as_str())
            .map(|k| format!("https://openlibrary.org{k}"));
        sqlx::query(DB_LEARNING_MATERIAL_INSERT)
            .bind(title)
            .bind(format!("Author: {author}{}", year.map_or_else(String::new, |y| format!(" | Year: {y}"))))
            .bind("book")
            .bind("Information Technology")
            .bind(cover.as_deref().unwrap_or(""))
            .bind(ol_url.as_deref().unwrap_or(""))
            .bind("published")
            .execute(pool.db())
            .await
            .map_err(|e| e.to_string())?;
        added += 1;
    }
    Ok(CrawlResult { success: true, added, message: format!("Đã thêm {added} cuốn sách mới.") })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/crawler/trigger` — kích hoạt một quy trình crawl.
pub async fn trigger_crawl(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<TriggerBody>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    if !VALID_CRAWL_TYPES.contains(&body.type_.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid crawl type. Valid types: {}",
            VALID_CRAWL_TYPES.join(", ")
        )));
    }

    let s = state();
    {
        let mut st = s.lock().unwrap();
        if st.status.is_running {
            return Ok(Json(ApiResponse::ok(serde_json::json!({
                "success": false, "message": "A crawl process is already running"
            }))));
        }
        st.status = CrawlStatus {
            is_running: true,
            current_type: Some(body.type_.clone()),
            start_time: Some(now_iso()),
            last_completed: st.status.last_completed.clone(),
            total_crawled: 0,
            errors: 0,
        };
    }

    let history_id = format!("crawl-{}", epoch());
    let started = now_iso();
    // persist the running row
    let _ = sqlx::query(DB_INSERT_CRAWL_HISTORY)
        .bind(&body.type_)
        .bind("running")
        .bind(0_i64)
        .bind(0_i64)
        .bind("Crawl in progress")
        .bind(0_i64)
        .bind(user.id.as_str())
        .bind(false)
        .bind(&started)
        .bind::<Option<String>>(None)
        .execute(pool.db())
        .await;

    let params = body.params.clone().unwrap_or_default();
    let client = client();
    let result: Result<CrawlResult, String> = match body.type_.as_str() {
        // map/wifi/schools/green_spaces: crawl thu hồi — POI đã crawl trong DB
        "map" => Ok(crawl_no_op(&client, &pool)),
        "wifi" => Ok(crawl_no_op(&client, &pool)),
        "schools" => Ok(crawl_no_op(&client, &pool)),
        "green_spaces" => Ok(crawl_no_op(&client, &pool)),
        "books" => {
            let keyword = param_str(&params, "keyword").unwrap_or_else(|| "computer science".to_string());
            let limit = params.get("limit").and_then(|x| x.as_i64()).unwrap_or(20);
            crawl_books(&client, &pool, keyword, limit).await
        }
        "all" => {
            let mut details = Vec::new();
            let mut total_added = 0_i64;
            let mut ok = true;
            for t in ["map", "books"] {
                let (success, added, message) = match t {
                    "map" => {
                        let r = crawl_no_op(&client, &pool);
                        (r.success, r.added, r.message)
                    }
                    "books" => match crawl_books(&client, &pool, "computer science".to_string(), 20).await {
                        Ok(r) => (true, r.added, r.message),
                        Err(e) => { ok = false; (false, 0, e) },
                    },
                    _ => (false, 0, "unknown".to_string()),
                };
                details.push(serde_json::json!({
                    "type": t, "success": success, "added": added, "message": message,
                }));
                total_added += added;
            }
            if ok {
                return Ok(Json(ApiResponse::ok(serde_json::json!({
                    "success": true,
                    "added": total_added,
                    "message": format!("Crawl tất cả xong. Tổng: {total_added} bản ghi."),
                    "details": details,
                }))));
            }
            return Ok(Json(ApiResponse::ok(serde_json::json!({
                "success": false,
                "added": 0,
                "message": "Lỗi crawl tất cả.",
                "details": details,
            }))));
        }
        _ => return Err(AppError::BadRequest("Unknown crawl type".to_string())),
    };

    let ended = now_iso();
    let mut st = s.lock().unwrap();
    match result {
        Ok(r) => {
            st.status.is_running = false;
            st.status.current_type = None;
            st.status.last_completed = Some(ended.clone());
            st.status.total_crawled += r.added;
            st.history.push(CrawlHistoryEntry {
                id: history_id.clone(),
                type_: body.type_.clone(),
                status: "success".to_string(),
                start_time: started.clone(),
                end_time: Some(ended.clone()),
                records_added: r.added,
                errors: 0,
                message: r.message.clone(),
            });
            let _ = sqlx::query(DB_UPDATE_CRAWL_HISTORY)
                .bind(&history_id)
                .bind("success")
                .bind(r.added)
                .bind(0_i64)
                .bind(r.message.as_str())
                .bind(&ended)
                .execute(pool.db())
                .await;
            Ok(Json(ApiResponse::ok(serde_json::json!({"success": true, "added": r.added, "message": r.message}))))
        }
        Err(e) => {
            st.status.is_running = false;
            st.status.current_type = None;
            st.status.errors += 1;
            st.history.push(CrawlHistoryEntry {
                id: history_id.clone(),
                type_: body.type_.clone(),
                status: "failed".to_string(),
                start_time: started.clone(),
                end_time: Some(ended.clone()),
                records_added: 0,
                errors: 1,
                message: e.clone(),
            });
            let _ = sqlx::query(DB_UPDATE_CRAWL_HISTORY)
                .bind(&history_id)
                .bind("failed")
                .bind(0_i64)
                .bind(1_i64)
                .bind(e.as_str())
                .bind(&ended)
                .execute(pool.db())
                .await;
            Ok(Json(ApiResponse::failure(e)))
        }
    }
}

/// `GET /api/crawler/status` — trạng thái crawl hiện tại.
pub async fn get_crawl_status(State(_pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let st = state().lock().unwrap();
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "isRunning": st.status.is_running,
        "currentType": st.status.current_type,
        "startTime": st.status.start_time,
        "lastCompleted": st.status.last_completed,
        "totalCrawled": st.status.total_crawled,
        "errors": st.status.errors,
    }))))
}

/// `GET /api/crawler/history` — lịch sử crawl (50 bản gần nhất).
pub async fn get_crawl_history(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let st = state().lock().unwrap();
    let history: Vec<Value> = if st.history.is_empty() {
        // khởi động lại: lấy từ DB
        sqlx::query(DB_HISTORY_ALL)
            .fetch_all(pool.db())
            .await
            .map_err(|e| AppError::Internal(format!("failed to read crawl history: {e}")))?
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String>("id"),
                    "type": row.get::<Option<String>>("type"),
                    "status": row.get::<Option<String>>("status"),
                    "startTime": row.get::<Option<String>>("start_time"),
                    "endTime": row.get::<Option<String>>("end_time"),
                    "recordsAdded": row.get::<i64>("records_added"),
                    "errors": row.get::<i64>("errors"),
                    "message": row.get::<Option<String>>("message"),
                })
            })
            .collect()
    } else {
        st.history.iter().rev().take(50).map(|h| {
            serde_json::json!({
                "id": h.id, "type": h.type_, "status": h.status,
                "startTime": h.start_time, "endTime": h.end_time,
                "recordsAdded": h.records_added, "errors": h.errors, "message": h.message,
            })
        }).collect()
    };
    Ok(Json(ApiResponse::ok(serde_json::json!({"history": history}))))
}

/// `GET /api/crawler/stats` — thống kê crawl.
pub async fn get_crawl_stats(State(_pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let st = state().lock().unwrap();
    let total = st.history.len() as i64;
    let successful = st.history.iter().filter(|h| h.status == "success").count() as i64;
    let failed = total - successful;
    let total_records: i64 = st.history.iter().map(|h| h.records_added).sum();
    let rate = if total > 0 {
        format!("{:.2}%", (successful as f64 / total as f64) * 100.0)
    } else {
        "0%".to_string()
    };
    let last = st.history.last().map(|h| {
        serde_json::json!({
            "id": h.id, "type": h.type_, "status": h.status,
            "startTime": h.start_time, "recordsAdded": h.records_added,
        })
    });
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "totalCrawls": total, "successfulCrawls": successful, "failedCrawls": failed,
        "successRate": rate, "totalRecords": total_records, "lastCrawl": last,
    }))))
}

/// `GET /api/crawler/types` — danh sách kiểu crawl hợp lệ.
pub async fn get_crawl_types(State(_pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    Ok(Json(ApiResponse::ok(serde_json::json!({"types": VALID_CRAWL_TYPES.iter().map(|s| s.to_string()).collect::<Vec<_>>() }))))
}