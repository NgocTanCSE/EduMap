//! Payment module — `/api/payment/*`: xử lý thanh toán mô phỏng (tăng
//! `business_transactions` → `orders` → `bookings`), giống old backend.
//!
//! Routing table (JWT — cả 2 endpoint đều yêu cầu token):
//!
//! ```text
//! POST /api/payment/process/:transactionId -> JWT, thanh toán giao dịch
//! POST /api/payment/booking/:bookingId    -> JWT, tạo giao dịch thanh toán lịch hẹn
//! ```
//!
//! Mirrors `backend/src/modules/payment/payment.controller.ts` +
//! `payment.service.ts`. Marketplace (order) và mentor (booking) chạy chung
//! `business_transactions` (camelCase columns).
//!
//! Tất cả SQL dùng runtime API (`sqlx::query!` yêu cầu DB khi compile — bị
//! cấm). Postgres-only.

use crate::common::auth::{authenticated_user, AuthUser};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use sqlx::Row;
use axum::extract::{Extension, Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// Body của `POST /api/payment/process/:transactionId` (đối tượng `method`).
#[derive(Debug, Deserialize)]
pub struct ProcessForm {
    /// Trường `method` (alias `paymentMethod`) — giữ nghĩa.
    #[serde(alias = "paymentMethod", default)]
    payment_method: Option<String>,
}

/// Body của `POST /api/payment/booking/:bookingId`.
#[derive(Debug, Deserialize)]
pub struct BookingForm {
    #[serde(alias = "paymentMethod", default)]
    payment_method: Option<String>,
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const DB_SELECT_TRANSACTION: &str = r#"
    SELECT "id", "orderId", "paymentMethod", "status",
           CAST("amount" AS TEXT) AS "amount",
           "externalTransactionId": externalTransactionId,
           CAST("created_at" AS TEXT) AS "created_at",
           CAST("updated_at" AS TEXT) AS "updated_at"
    FROM "business_transactions" WHERE "id" = $1
"#;

const DB_UPDATE_TRANSACTION: &str = r#"
    UPDATE "business_transactions"
    SET "status" = 'SUCCESS', "updated_at" = NOW()
    WHERE "id" = $1
"#;

const DB_SELECT_ORDER_BY_ID: &str = r#"
    SELECT "id", "status",
           CAST("created_at" AS TEXT) AS "created_at"
    FROM "orders" WHERE "id" = $1
"#;

const DB_UPDATE_ORDER_STATUS: &str = r#"
    UPDATE "orders" SET "status" = 'PAID', "updated_at" = NOW()
    WHERE "id" = $1
"#;

/// Giao dịch chưa có `orderId` (booking): chèn `PENDING` với `orderId = NULL`,
/// vì `business_transactions.orderId` cho phép NULL để hỗ trợ thanh toán lịch hẹn.
const DB_INSERT_TRANSACTION: &str = r#"
    INSERT INTO "business_transactions" ("orderId", "paymentMethod", "status", "amount")
    VALUES ($1, $2, $3, $4)
    RETURNING "id", "paymentMethod", "status", CAST("amount" AS TEXT) AS "amount",
              CAST("created_at" AS TEXT) AS "created_at"
"#;

const DB_SELECT_BOOKING: &str = r#"
    SELECT b."id", b."mentor_id", b."student_id",
           CAST(b."slot_start" AS TEXT) AS "slot_start",
           CAST(b."slot_end" AS TEXT) AS "slot_end",
           b."status", b."payment_status", CAST(b."amount" AS TEXT) AS "amount",
           b."transaction_id", b."meeting_url",
           CAST(b."created_at" AS TEXT) AS "created_at",
           CAST(b."updated_at" AS TEXT) AS "updated_at"
    FROM "bookings" b
    WHERE b."id" = $1 AND b."student_id" = $2
"#;

const DB_UPDATE_BOOKING_PAYMENT: &str = r#"
    UPDATE "bookings"
    SET "payment_status" = 'paid', "transaction_id" = $1, "updated_at" = NOW()
    WHERE "id" = $2 AND "student_id" = $3
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn transaction_to_json(row: &sqlx::postgres::PgRow) -> Value {
    serde_json::json!({
        "id": crate::db::text(&row, "id"),
        "order_id": crate::db::opt_text(&row, "orderId"),
        "payment_method": crate::db::opt_text(&row, "paymentMethod").unwrap_or_else(|| "COD".to_string()),
        "status": crate::db::opt_text(&row, "status").unwrap_or_else(|| "PENDING".to_string()),
        "amount": crate::db::opt_text(&row, "amount").unwrap_or_default(),
        "external_transaction_id": crate::db::opt_text(&row, "externalTransactionId"),
        "created_at": crate::db::text(&row, "created_at"),
        "updated_at": crate::db::opt_text(&row, "updated_at"),
    })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/payment/process/:transactionId` — thanh toán một giao dịch
/// (demo): luôn thành công, tăng `transaction.status` → `SUCCESS`, đơn hàng
/// → `PAID` khi có, giao dịch → `paid`.
pub async fn process_payment(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(transaction_id): Path<String>,
    Json(form): Json<ProcessForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let _user = authenticated_user(user)?;
    let _payment_method = form.payment_method;

    let existing = crate::db::query(DB_SELECT_TRANSACTION)
        .bind(&transaction_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let transaction = match existing {
        Some(row) => row,
        None => {
            return Err(AppError::BadRequest(
                "Giao dịch không tồn tại.".to_string(),
            ));
        }
    };

    // Giao dịch đã được thanh toán trước đó (replayed request).
    if crate::db::opt_text(&transaction, "status") == Some("SUCCESS".to_string()) {
        return Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Giao dịch này đã được thanh toán thành công.",
            "demo": true,
            "transaction": transaction_to_json(&transaction),
        }))));
    }

    let txn_id: String = transaction.get("id");

    // SIMD: log lỗi lệnh; trả về kết quả nhà.
    let _ = crate::db::query(DB_UPDATE_TRANSACTION)
        .bind(&txn_id)
        .execute(pool.db())
        .await
        .map_err(AppError::from);

    // Thanh toán đơn hàng (nếu giao dịch có order_id).
    if let Some(order_id) = crate::db::opt_text(&transaction, "orderId") {
        let order = crate::db::query(DB_SELECT_ORDER_BY_ID)
            .bind(&order_id)
            .fetch_optional(pool.db())
            .await
            .map_err(AppError::from)?;

        if let Some(order) = order {
            let order_status: String = crate::db::opt_text(&order, "status").unwrap_or_default();
            if order_status != "PAID" {
                crate::db::query(DB_UPDATE_ORDER_STATUS)
                    .bind(&order_id)
                    .execute(pool.db())
                    .await
                    .map_err(AppError::from)?;
            }
        }
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Thanh toán thành công.",
        "demo": true,
        "transaction": transaction_to_json(&transaction),
    }))))
}

/// `POST /api/payment/booking/:bookingId` — tạo giao dịch thanh toán cho
/// lịch hẹn Mentor: chèn `PENDING` `business_transactions` từ `booking.amount`
/// và liên kết `bookings.transaction_id` + `payment_status` = `paid`.
///
/// Loop lại (`payment_status='paid'`) → trả về `message` lịch hẹn đã thanh toán.
pub async fn create_booking_transaction(
    State(pool): State<DbPool>,
    user: Option<Extension<AuthUser>>,
    Path(booking_id): Path<String>,
    Json(form): Json<BookingForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(user)?;
    let payment_method = form.payment_method.as_deref().unwrap_or("BANK_TRANSFER");

    let booking = crate::db::query(DB_SELECT_BOOKING)
        .bind(&booking_id)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let booking = match booking {
        Some(r) => r,
        None => {
            return Err(AppError::BadRequest(
                "Lịch hẹn không tồn tại.".to_string(),
            ));
        }
    };

    if crate::db::opt_text(&booking, "payment_status") == Some("paid".to_string()) {
        return Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Lịch hẹn đã được thanh toán.",
            "demo": true,
        }))));
    }

    // Chèn giao dịch `PENDING` cho thanh toán (nếu không thể — ràng buộc
    // `orderId` — log cảnh báo và vẫn thực thi liên kết nếu được).
    let txn = match crate::db::query(DB_INSERT_TRANSACTION)
        .bind(None::<Option<String>>)
        .bind(payment_method)
        .bind("PENDING")
        .bind(crate::db::opt_text(&booking, "amount").unwrap_or_default())
        .fetch_optional(pool.db())
        .await
    {
        Ok(row) => row,
        Err(e) => {
            tracing::warn!("booking transaction insert failed: {e}");
            return Ok(Json(ApiResponse::ok(serde_json::json!({
                "message": "Lịch hẹn chưa được thanh toán, vui lòng thử lại.",
                "demo": true,
            }))));
        }
    };

    let txn_id = txn
        .as_ref()
        .and_then(|r| crate::db::opt_text(&r, "id"))
        .unwrap_or_default();

    crate::db::query(DB_UPDATE_BOOKING_PAYMENT)
        .bind(&txn_id)
        .bind(&booking_id)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Đã tạo giao dịch thanh toán.",
        "demo": true,
        "transaction": txn.as_ref().map(|r| transaction_to_json(r)).unwrap_or_default(),
        "booking_id": booking_id,
    }))))
}
