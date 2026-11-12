//! Donate module — `/api/donations/*`: chiến dịch quyên góp (danh sách, chi tiết,
//! danh sách nhà hảo tâm), tạo chiến dịch, tạo URL thanh toán VNPay và ghi nhận
//! khoản quyên góp.
//!
//! Mirrors `backend/src/modules/donate/donate.controller.ts`,
//! `donate.service.ts` và `vnpay.service.ts` (NestJS). Các endpoint danh sách,
//! chi tiết và danh sách nhà hảo tâm là public (khách chưa đăng nhập cũng xem
//! được); các handler write (tạo chiến dịch, tạo URL thanh toán, quyên góp) tự
//! kiểm JWT và trả `401` khi token thiếu.
//!
//! Ghi chú quan trọng:
//!   * `vnp_Amount` = số tiền × 100 (đơn vị xu, giữ nguyên hành vi old backend).
//!   * Chuỗi ký tên = các tham số sắp xếp theo tên, percent-encode giá trị
//!     (giống `encodeURIComponent` + thay `%20` bằng `+`); `vnp_SecureHash`
//!     được thêm vào cuối và KHÔNG tham gia ký tên — đúng như old JS.
//!   * PostGIS: `location_point` đọc qua `ST_AsText`, ghi qua
//!     `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`.
//!   * Cột DECIMAL đọc dưới `TEXT`, timestamp đọc qua `CAST(... AS TEXT)`.
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, State};
use axum::http::Request;
use axum::Json;
use chrono::Utc;
use hmac::{Hmac, Mac};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use sha2::Sha512;
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};

// ---------------------------------------------------------------------------
// Auth helpers (giống business.rs / career.rs)
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các route public của donate (danh sách/chi tiết
// chiến dịch, danh sách nhà hảo tâm) không nhận `AuthUser` từ router, nên các
// handler write tự kiểm và trả `401` khi JWT thiếu.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string()))
}

/// Lỗi sqlx → `AppError`, với mã `23505` (trùng khoá duy nhất) thành `Conflict`.
fn to_app_error(e: sqlx::Error) -> AppError {
    if let Some(db_err) = e.as_database_error() {
        if db_err.code().to_string() == "23505" {
            return AppError::Conflict("Dữ liệu đã tồn tại (trùng khoá duy nhất).".to_string());
        }
    }
    AppError::from(e)
}

// ---------------------------------------------------------------------------
// VNPay configuration (mirrors NestJS `ConfigService`)
// ---------------------------------------------------------------------------

static VNP_TMN_CODE: Lazy<String> = Lazy::new(|| env_var_or("VNP_TMN_CODE", ""));
static VNP_HASH_SECRET: Lazy<String> = Lazy::new(|| env_var_or("VNP_HASH_SECRET", ""));
static VNP_URL: Lazy<String> =
    Lazy::new(|| env_var_or("VNP_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"));
static VNP_RETURN_URL: Lazy<String> = Lazy::new(|| env_var_or("VNP_RETURN_URL", ""));

fn env_var_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

// ---------------------------------------------------------------------------
// Request forms
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct CreateCampaignForm {
    title: String,
    description: String,
    target_amount: String,
    start_date: Option<String>,
    end_date: Option<String>,
    longitude: Option<String>,
    latitude: Option<String>,
    images: Option<String>,
}

#[derive(Deserialize)]
struct PaymentUrlForm {
    amount: f64,
    bank_code: Option<String>,
    order_info: Option<String>,
    order_type: Option<String>,
}

#[derive(Deserialize)]
struct DonationForm {
    campaign_id: String,
    amount: f64,
    is_anonymous: Option<bool>,
    transaction_id: Option<String>,
}

// ---------------------------------------------------------------------------
// VNPay (mirrors `vnpay.service.ts`)
// ---------------------------------------------------------------------------

/// Bộ đếm phụ cho `vnp_TxnRef`, thay thế `Math.random()` của old backend.
static TXN_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

/// `yyyyMMddHHmmss` — giống `formatDate()` trong old service.
fn vnp_timestamp() -> String {
    Utc::now().format("%Y%m%d%H%M%S").to_string()
}

/// Percent-encode một giá trị, giữ nguyên nhóm unreserved của JavaScript
// `encodeURIComponent` và thay `%20` bằng `+` (byte-by-byte, UTF-8).
fn vnp_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// HMAC-SHA512 dạng hex, dùng để ký chuỗi tham số VNPay.
fn vnp_hmac(secret: &str, data: &str) -> Result<String, AppError> {
    let mut mac = Hmac::<Sha512>::new_from_slice(secret.as_bytes()).map_err(|_| {
        AppError::Internal("VNPay: không thể tạo HMAC (khoá bí mật không hợp lệ)".to_string())
    })?;
    mac.update(data.as_bytes());
    Ok(mac.finalize().into_hex())
}

/// Tạo URL thanh toán VNPay (tương đương `VNPayService.createPaymentUrl`).
fn vnpay_build_url(
    ip_addr: &str,
    amount: f64,
    bank_code: Option<String>,
    order_info: Option<String>,
    order_type: Option<String>,
    user_id: &str,
) -> Result<String, AppError> {
    let tmn_code = VNP_TMN_CODE.as_str();
    let secret = VNP_HASH_SECRET.as_str();
    if tmn_code.is_empty() || secret.is_empty() {
        return Err(AppError::Internal(
            "VNPay configuration is missing. Please set VNP_TMN_CODE and VNP_HASH_SECRET environment \
             variables."
                .to_string(),
        ));
    }
    let return_url = VNP_RETURN_URL.as_str();
    if return_url.is_empty() {
        return Err(AppError::Internal(
            "VNPay return URL is missing (set VNP_RETURN_URL).".to_string(),
        ));
    }

    let create_date = vnp_timestamp();
    let txn_ref = format!(
        "{}{:03}",
        create_date,
        TXN_SEQUENCE.fetch_add(1, Ordering::SeqCst) % 1000
    );

    let mut params = BTreeMap::new();
    params.insert("vnp_Version".to_string(), "2.1.0".to_string());
    params.insert("vnp_Command".to_string(), "pay".to_string());
    params.insert("vnp_TmnCode".to_string(), tmn_code.to_string());
    params.insert("vnp_Locale".to_string(), "vn".to_string());
    params.insert("vnp_CurrCode".to_string(), "VND".to_string());
    params.insert("vnp_TxnRef".to_string(), txn_ref);
    params.insert(
        "vnp_OrderInfo".to_string(),
        vnp_encode(&order_info.unwrap_or_else(|| format!("Donation_{}", user_id))),
    );
    params.insert(
        "vnp_OrderType".to_string(),
        vnp_encode(&order_type.unwrap_or_else(|| "donation".to_string())),
    );
    // Old backend: `vnp_Amount = amount * 100` (đơn vị xu).
    params.insert(
        "vnp_Amount".to_string(),
        format!("{:.0}", (amount * 100.0).round()),
    );
    params.insert("vnp_ReturnUrl".to_string(), vnp_encode(return_url));
    params.insert("vnp_IpAddr".to_string(), ip_addr.to_string());
    params.insert("vnp_CreateDate".to_string(), create_date.clone());
    if let Some(bank) = bank_code.filter(|b| !b.is_empty()) {
        params.insert("vnp_BankCode".to_string(), bank);
    }

    // Chuỗi ký tên: các tham số đã sắp xếp, secure hash CHƯA được thêm vào.
    let sign_data = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");
    let signature = vnp_hmac(secret, &sign_data)?;

    let mut final_params = params;
    final_params.insert("vnp_SecureHash".to_string(), signature);
    let query = final_params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");

    Ok(format!("{}?{}", VNP_URL.as_str(), query))
}

/// Địa chỉ IP của người gọi (ưu tiên `X-Forwarded-For`, như old backend).
fn client_ip(req: &Request) -> String {
    if let Some(hdr) = req.headers().get("x-forwarded-for") {
        if let Ok(forwarded) = hdr.to_str() {
            return forwarded
                .split(',')
                .next()
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| "127.0.0.1".to_string());
        }
    }
    "127.0.0.1".to_string()
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_CAMPAIGNS: &str = r#"
    SELECT "id", "title", "description", "target_amount", "current_amount",
           "organizer_id", ST_AsText("location_point") AS "location_point",
           "address", "status", CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           CAST("images" AS TEXT) AS "images",
           CAST("created_at" AS TEXT) AS "created_at",
           CAST("updated_at" AS TEXT) AS "updated_at"
    FROM "donation_campaigns"
    ORDER BY "created_at" DESC
"#;

const DB_CAMPAIGN_BY_ID: &str = r#"
    SELECT "id", "title", "description", "target_amount", "current_amount",
           "organizer_id", ST_AsText("location_point") AS "location_point",
           "address", "status", CAST("start_date" AS TEXT) AS "start_date",
           CAST("end_date" AS TEXT) AS "end_date",
           CAST("images" AS TEXT) AS "images",
           CAST("created_at" AS TEXT) AS "created_at",
           CAST("updated_at" AS TEXT) AS "updated_at"
    FROM "donation_campaigns"
    WHERE "id" = $1
"#;

const DB_DONORS: &str = r#"
    SELECT CAST("d"."id" AS TEXT) AS "id",
           CAST("d"."amount" AS TEXT) AS "amount",
           CAST("d"."created_at" AS TEXT) AS "created_at",
           CAST("u"."id" AS TEXT) AS "donor_id",
           "u"."full_name" AS "full_name",
           "u"."avatar_url" AS "avatar_url"
    FROM "donations" AS "d"
    JOIN "users" AS "u" ON "u"."id" = "d"."donor_id"
    WHERE "d"."campaign_id" = $1 AND "d"."status" = 'completed'
    ORDER BY "d"."created_at" DESC
"#;

const DB_INSERT_CAMPAIGN: &str = r#"
    INSERT INTO "donation_campaigns"
        ("title", "description", "target_amount", "current_amount", "status",
         "organizer_id", "location_point", "start_date", "end_date", "images",
         "created_at", "updated_at")
    VALUES ($1, $2, $3, 0, 'active', $4,
            ST_SetSRID(ST_MakePoint($5, $6), 4326),
            $7, $8, $9, NOW(), NOW())
    RETURNING "id"
"#;

const DB_LOCK_CAMPAIGN: &str = r#"
    SELECT "id", "status", "title", "target_amount", "current_amount"
    FROM "donation_campaigns"
    WHERE "id" = $1 FOR UPDATE
"#;

const DB_INSERT_DONATION: &str = r#"
    INSERT INTO "donations"
        ("campaign_id", "donor_id", "amount", "currency", "payment_method",
         "payment_status", "transaction_id", "is_anonymous")
    VALUES ($1, $2, $3, 'VND', 'bank_transfer', 'completed', $4, $5)
    RETURNING "id", "transaction_id"
"#;

const DB_INCREMENT_AMOUNT: &str = r#"
    UPDATE "donation_campaigns"
    SET "current_amount" = "current_amount" + $1
    WHERE "id" = $2
"#;

const DB_UPDATED_CAMPAIGN: &str = r#"
    SELECT "id", "title", "current_amount", "target_amount"
    FROM "donation_campaigns"
    WHERE "id" = $1
"#;

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn campaign_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<Option<String>>("id").unwrap_or_default(),
        "title": row.get::<Option<String>>("title").unwrap_or_default(),
        "description": row.get::<Option<String>>("description").unwrap_or_default(),
        "target_amount": row
            .get::<Option<String>>("target_amount")
            .unwrap_or_else(|| "0".to_string()),
        "current_amount": row
            .get::<Option<String>>("current_amount")
            .unwrap_or_else(|| "0".to_string()),
        "organizer_id": row.get::<Option<String>>("organizer_id").unwrap_or_default(),
        "location_point": row.get::<Option<String>>("location_point"),
        "address": row.get::<Option<String>>("address").unwrap_or_default(),
        "status": row.get::<Option<String>>("status").unwrap_or_else(|| "active".to_string()),
        "start_date": row.get::<Option<String>>("start_date"),
        "end_date": row.get::<Option<String>>("end_date"),
        "images": row.get::<Option<String>>("images").map(Value::String).unwrap_or(Value::Null),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        "updated_at": row.get::<Option<String>>("updated_at").unwrap_or_default(),
    })
}

fn donor_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<Option<String>>("id").unwrap_or_default(),
        "amount": row
            .get::<Option<String>>("amount")
            .unwrap_or_else(|| "0".to_string()),
        "created_at": row.get::<Option<String>>("created_at").unwrap_or_default(),
        "donor": serde_json::json!({
            "id": row.get::<Option<String>>("donor_id").unwrap_or_default(),
            "fullName": row.get::<Option<String>>("full_name").unwrap_or_default(),
            "avatarUrl": row.get::<Option<String>>("avatar_url").unwrap_or_default(),
        }),
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/donations/campaigns` — danh sách chiến dịch (public).
pub async fn get_campaigns(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_CAMPAIGNS)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let campaigns: Vec<Value> = rows.into_iter().map(|r| campaign_to_json(&r)).collect();
    Ok(Json(ApiResponse::ok(Value::Array(campaigns))))
}

/// `GET /api/donations/campaigns/:id` — chi tiết một chiến dịch (public).
pub async fn get_campaign_by_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_CAMPAIGN_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let campaign = match row {
        Some(row) => campaign_to_json(&row),
        None => return Ok(Json(ApiResponse::ok(Value::Null))),
    };
    Ok(Json(ApiResponse::ok(campaign)))
}

/// `GET /api/donations/campaigns/:id/donors` — danh sách nhà hảo tâm đã hoàn
/// thành quyên góp cho một chiến dịch (public).
pub async fn get_donors_by_campaign_id(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_DONORS)
        .bind(&id)
        .fetch_all(pool.db())
        .await
        .map_err(AppError::from)?;
    let donors: Vec<Value> = rows.into_iter().map(|r| donor_to_json(&r)).collect();
    Ok(Json(ApiResponse::ok(Value::Array(donors))))
}

/// `POST /api/donations/campaigns` — tạo chiến dịch quyên góp mới (JWT).
pub async fn create_campaign(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CreateCampaignForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let inserted = sqlx::query(DB_INSERT_CAMPAIGN)
        .bind(&form.title)
        .bind(&form.description)
        .bind(&form.target_amount)
        .bind(&user.id)
        .bind(form.longitude.as_deref().and_then(|v| v.parse::<f64>().ok()))
        .bind(form.latitude.as_deref().and_then(|v| v.parse::<f64>().ok()))
        .bind(form.start_date.as_deref())
        .bind(form.end_date.as_deref())
        .bind(form.images.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    let id: String = inserted.get("id");
    let row = sqlx::query(DB_CAMPAIGN_BY_ID)
        .bind(&id)
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(campaign_to_json(&row))))
}

/// `POST /api/donations/payment-url` — tạo URL thanh toán VNPay (JWT).
pub async fn create_payment_url(
    req: Request,
    Json(form): Json<PaymentUrlForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if !(form.amount > 0.0) {
        return Err(AppError::BadRequest("Số tiền phải lớn hơn 0".to_string()));
    }

    let url = vnpay_build_url(
        &client_ip(&req),
        form.amount,
        form.bank_code,
        form.order_info,
        form.order_type,
        &user.id,
    )?;

    Ok(Json(ApiResponse::ok(serde_json::json!({ "paymentUrl": url }))))
}

/// `POST /api/donations` — ghi nhận một khoản quyên góp (JWT).
/// Tương đương `DonateService.processDonation`: khoá hàng chiến dịch
/// (`FOR UPDATE`), kiểm trạng thái `active`, ghi nhận khoản đóng góp, cộng
/// dồn `current_amount` — tất cả trong một giao dịch, rollback khi lỗi.
pub async fn process_donation(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<DonationForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if !(form.amount > 0.0) {
        return Err(AppError::BadRequest("Số tiền quyên góp phải lớn hơn 0".to_string()));
    }

    let donor_id = if form.is_anonymous.unwrap_or(false) {
        None
    } else {
        Some(user.id.clone())
    };

    let transaction_id = form.transaction_id.unwrap_or_else(|| {
        format!(
            "TXN-{}-{:04}",
            Utc::now().timestamp_millis(),
            TXN_SEQUENCE.fetch_add(1, Ordering::SeqCst) % 10000
        )
    });

    let mut tx = match pool.db().begin().await {
        Ok(tx) => tx,
        Err(e) => return Err(AppError::from(e)),
    };

    let campaign = sqlx::query(DB_LOCK_CAMPAIGN)
        .bind(&form.campaign_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from)?;

    let campaign = match campaign {
        Some(row) => row,
        None => {
            let _ = tx.rollback().await;
            return Err(AppError::NotFound("Chiến dịch quyên góp không tồn tại".to_string()));
        }
    };

    let status: Option<String> = campaign.get("status");
    if status.as_deref() != Some("active") {
        let _ = tx.rollback().await;
        return Err(AppError::BadRequest(
            "Chiến dịch này đã đóng hoặc đã kết thúc!".to_string(),
        ));
    }

    let amount_text = format!("{:.2}", form.amount);

    sqlx::query(DB_INSERT_DONATION)
        .bind(&form.campaign_id)
        .bind(donor_id.as_deref())
        .bind(&amount_text)
        .bind(&transaction_id)
        .bind(form.is_anonymous.unwrap_or(false))
        .execute(&mut *tx)
        .await
        .map_err(to_app_error)?;

    sqlx::query(DB_INCREMENT_AMOUNT)
        .bind(&amount_text)
        .bind(&form.campaign_id)
        .execute(&mut *tx)
        .await
        .map_err(to_app_error)?;

    let updated = sqlx::query(DB_UPDATED_CAMPAIGN)
        .bind(&form.campaign_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(to_app_error)?;

    tx.commit().await.map_err(AppError::from)?;

    let response = serde_json::json!({
        "status": "success",
        "message": "Cảm ơn bạn đã quyên góp hỗ trợ cộng đồng!",
        "transaction_id": transaction_id,
        "campaign": serde_json::json!({
            "id": updated.get::<Option<String>>("id").unwrap_or_default(),
            "title": updated.get::<Option<String>>("title").unwrap_or_default(),
            "current_amount": updated
                .get::<Option<String>>("current_amount")
                .unwrap_or_else(|| "0".to_string()),
            "target_amount": updated
                .get::<Option<String>>("target_amount")
                .unwrap_or_else(|| "0".to_string()),
        }),
    });

    Ok(Json(ApiResponse::ok(response)))
}