//! Business module — `/api/business/*`: hồ sơ doanh nghiệp (danh sách, chi tiết,
//! tạo/cập nhật, xác minh), sản phẩm và dịch vụ (CRUD, theo chủ sở hữu),
//! đánh giá (một đánh giá/một người/một mục), giỏ hàng (thêm/xóa/xoá sạch),
//! thanh toán (một giao dịch Postgres原子 — rollback khi lỗi) và đơn hàng
//! (góc nhìn người mua + góc nhìn doanh nghiệp).
//!
//! Mirrors `backend/src/modules/business/business.controller.ts` +
//! `business.service.ts`. Các endpoint danh sách/chi tiết là public (phục vụ
//! marketplace/storefront); các handler write tự xác thực.
//!
//! Tất cả SQL dùng runtime API (`query!` yêu cầu DB khi compile — bị cấm).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::extract::{Path, State};
use axum::http::Request;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Auth helpers (giống career.rs / admin.rs)
// ---------------------------------------------------------------------------

/// Người dùng đã đăng nhập: các route public của business (danh sách sản phẩm,
// dịch vụ, hồ sơ) không nhận `AuthUser` từ router (`PUBLIC_PATHS`), nên các
// handler write tự kiểm và trả `401` khi JWT thiếu.
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// `admin` / `moderator` only (`@Roles(ADMIN, MODERATOR)` ở old backend).
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

/// Kiểm tra người gọi có phải là chủ sở hữu của hồ sơ doanh nghiệp hay không.
// Các thao tác CRUD sản phẩm/dịch vụ bị khoá theo `user_id` của hồ sơ —
// tương đương với `@Roles(EMPLOYER, ADMIN)` kết hợp kiểm tra owner ở old service.
async fn ensure_owner(
    pool: &DbPool,
    bp_id: &str,
    user: &AuthUser,
) -> Result<(), AppError> {
    let row = sqlx::query(r#"SELECT "user_id" FROM business_profiles WHERE "id" = $1"#)
        .bind(bp_id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    let owner = match row {
        Some(r) => r.get::<String>("user_id"),
        None => {
            return Err(AppError::NotFound("Hồ sơ doanh nghiệp không tồn tại.".to_string()))
        }
    };

    if owner != user.id {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thao tác trên hồ sơ doanh nghiệp này.".to_string(),
        ));
    }
    Ok(())
}

/// `business_profiles` của người gọi (dùng cho góc nhìn vendor).
async fn user_business_profile(pool: &DbPool, user: &AuthUser) -> Result<String, AppError> {
    let row = sqlx::query(r#"SELECT "id" FROM business_profiles WHERE "user_id" = $1"#)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(r.get::<String>("id")),
        None => Err(AppError::Forbidden("Chỉ dành cho doanh nghiệp.".to_string())),
    }
}

/// Chuyển `sqlx::Error` sang `AppError`, biến đổi unique-violation (23505)
// thành `Conflict` để frontend nhận được thông điệp rõ thay vì 500.
fn to_app_error(e: sqlx::Error) -> AppError {
    if let Some(db_err) = e.as_database_error() {
        if db_err.code().to_string() == "23505" {
            return AppError::Conflict("Dữ liệu đã tồn tại (trùng khoá duy nhất).".to_string());
        }
    }
    AppError::from(e)
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

// --- business_profiles -------------------------------------------------------

const DB_SELECT_PROFILES: &str = r#"
    SELECT "id", "user_id", "name", "description", "industry", "website",
           "logo_url", "address", CAST("lat" AS TEXT) AS lat,
           CAST("lng" AS TEXT) AS lng, "is_verified",
           (SELECT COUNT(*) FROM products p WHERE p."business_profile_id" = bp."id")
               AS products_count,
           (SELECT COUNT(*) FROM business_services s
               WHERE s."business_profile_id" = bp."id") AS services_count,
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM business_profiles bp
    ORDER BY "created_at" DESC
"#;

const DB_SELECT_PROFILE_BY_ID: &str = r#"
    SELECT "id", "user_id", "name", "description", "industry", "website",
           "logo_url", "address", CAST("lat" AS TEXT) AS lat,
           CAST("lng" AS TEXT) AS lng, "is_verified",
           (SELECT COUNT(*) FROM products p WHERE p."business_profile_id" = bp."id")
               AS products_count,
           (SELECT COUNT(*) FROM business_services s
               WHERE s."business_profile_id" = bp."id") AS services_count,
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM business_profiles bp
    WHERE "id" = $1
"#;

const DB_SELECT_PROFILE_BY_USER: &str = r#"
    SELECT "id", "user_id", "name", "description", "industry", "website",
           "logo_url", "address", CAST("lat" AS TEXT) AS lat,
           CAST("lng" AS TEXT) AS lng, "is_verified",
           (SELECT COUNT(*) FROM products p WHERE p."business_profile_id" = bp."id")
               AS products_count,
           (SELECT COUNT(*) FROM business_services s
               WHERE s."business_profile_id" = bp."id") AS services_count,
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM business_profiles bp
    WHERE "user_id" = $1
"#;

const DB_INSERT_PROFILE: &str = r#"
    INSERT INTO business_profiles ("user_id", "name", "description", "industry",
        "website", "logo_url", "address", "lat", "lng", "is_verified")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING "id", CAST("created_at" AS TEXT) AS created_at,
              CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_UPDATE_PROFILE: &str = r#"
    UPDATE business_profiles SET "name" = COALESCE($1, "name"),
        "description" = COALESCE($2, "description"),
        "industry" = COALESCE($3, "industry"),
        "website" = COALESCE($4, "website"),
        "logo_url" = COALESCE($5, "logo_url"),
        "updated_at" = NOW()
    WHERE "user_id" = $6
    RETURNING "id", CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_VERIFY_PROFILE: &str = r#"
    UPDATE business_profiles SET "is_verified" = true, "updated_at" = NOW()
    WHERE "id" = $1
    RETURNING "id", "is_verified", CAST("updated_at" AS TEXT) AS updated_at
"#;

// --- products ----------------------------------------------------------------

const DB_SELECT_PRODUCTS: &str = r#"
    SELECT "id", "name", "description", CAST("price" AS TEXT) AS price, "currency",
           "category", "stock", "image_url", "business_profile_id",
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM products WHERE "business_profile_id" = $1 ORDER BY "created_at" DESC
"#;

const DB_SELECT_PRODUCT_BY_ID: &str = r#"
    SELECT "id", "name", "description", CAST("price" AS TEXT) AS price, "currency",
           "category", "stock", "image_url", "business_profile_id",
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM products WHERE "id" = $1
"#;

const DB_INSERT_PRODUCT: &str = r#"
    INSERT INTO products ("name", "description", "price", "currency", "category",
        "stock", "image_url", "business_profile_id")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING "id", CAST("created_at" AS TEXT) AS created_at,
              CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_UPDATE_PRODUCT: &str = r#"
    UPDATE products SET "name" = COALESCE($1, "name"),
        "description" = COALESCE($2, "description"),
        "price" = COALESCE($3, "price"),
        "currency" = COALESCE($4, "currency"),
        "category" = COALESCE($5, "category"),
        "stock" = COALESCE($6, "stock"),
        "image_url" = COALESCE($7, "image_url"),
        "updated_at" = NOW()
    WHERE "id" = $8 AND "business_profile_id" = $9
    RETURNING "id", CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_DELETE_PRODUCT: &str = r#"
    DELETE FROM products WHERE "id" = $1 AND "business_profile_id" = $2
"#;

// --- business_services -------------------------------------------------------

const DB_SELECT_SERVICES: &str = r#"
    SELECT "id", "name", "description", CAST("price" AS TEXT) AS price, "currency",
           "category", "duration", "location", "business_profile_id",
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM business_services WHERE "business_profile_id" = $1 ORDER BY "created_at" DESC
"#;

const DB_SELECT_SERVICE_BY_ID: &str = r#"
    SELECT "id", "name", "description", CAST("price" AS TEXT) AS price, "currency",
           "category", "duration", "location", "business_profile_id",
           CAST("created_at" AS TEXT) AS created_at,
           CAST("updated_at" AS TEXT) AS updated_at
    FROM business_services WHERE "id" = $1
"#;

const DB_INSERT_SERVICE: &str = r#"
    INSERT INTO business_services ("name", "description", "price", "currency",
        "category", "duration", "location", "business_profile_id")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING "id", CAST("created_at" AS TEXT) AS created_at,
              CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_UPDATE_SERVICE: &str = r#"
    UPDATE business_services SET "name" = COALESCE($1, "name"),
        "description" = COALESCE($2, "description"),
        "price" = COALESCE($3, "price"),
        "currency" = COALESCE($4, "currency"),
        "category" = COALESCE($5, "category"),
        "duration" = COALESCE($6, "duration"),
        "location" = COALESCE($7, "location"),
        "updated_at" = NOW()
    WHERE "id" = $8 AND "business_profile_id" = $9
    RETURNING "id", CAST("updated_at" AS TEXT) AS updated_at
"#;

const DB_DELETE_SERVICE: &str = r#"
    DELETE FROM business_services WHERE "id" = $1 AND "business_profile_id" = $2
"#;

// --- reviews -----------------------------------------------------------------

const DB_SELECT_PRODUCT_REVIEWS: &str = r#"
    SELECT r."id", r."user_id", u.full_name, r."rating", r."comment",
           CAST(r."created_at" AS TEXT) AS created_at
    FROM reviews r LEFT JOIN users u ON u."id" = r."user_id"
    WHERE r."product_id" = $1 ORDER BY r."created_at" DESC
"#;

const DB_SELECT_SERVICE_REVIEWS: &str = r#"
    SELECT r."id", r."user_id", u.full_name, r."rating", r."comment",
           CAST(r."created_at" AS TEXT) AS created_at
    FROM reviews r LEFT JOIN users u ON u."id" = r."user_id"
    WHERE r."service_id" = $1 ORDER BY r."created_at" DESC
"#;

/// Phát hiện đánh giá đã tồn tại của cùng một người dùng trên cùng một mục.
// `reviews` không có unique constraint nên phải kiểm bằng query.
const DB_CHECK_REVIEW: &str = r#"
    SELECT "id" FROM reviews
    WHERE "user_id" = $1 AND COALESCE("product_id", "service_id") = $2
"#;

const DB_INSERT_REVIEW: &str = r#"
    INSERT INTO reviews ("user_id", "product_id", "service_id", "rating", "comment")
    VALUES ($1, $2, $3, $4, $5)
    RETURNING "id", CAST("created_at" AS TEXT) AS created_at
"#;

// --- cart --------------------------------------------------------------------

const DB_SELECT_CART: &str = r#"
    SELECT ci."id", ci."userId", ci."productId", ci."serviceId", ci."quantity",
           p.name AS product_name, CAST(p.price AS TEXT) AS product_price,
           p.image_url AS product_image, s.name AS service_name,
           CAST(s.price AS TEXT) AS service_price
    FROM cart_items ci
    LEFT JOIN products p ON p."id" = ci."productId"
    LEFT JOIN business_services s ON s."id" = ci."serviceId"
    WHERE ci."userId" = $1 ORDER BY ci."created_at" DESC
"#;

const DB_SELECT_CART_ITEM: &str = r#"
    SELECT "id", "quantity" FROM cart_items
    WHERE "userId" = $1
      AND (($2 IS NOT NULL AND "productId" = $2)
           OR ($3 IS NOT NULL AND "serviceId" = $3))
"#;

const DB_UPDATE_CART_QUANTITY: &str = r#"
    UPDATE cart_items SET "quantity" = "quantity" + $1, "updated_at" = NOW()
    WHERE "id" = $2 AND "userId" = $3
    RETURNING "quantity"
"#;

const DB_INSERT_CART_ITEM: &str = r#"
    INSERT INTO cart_items ("userId", "productId", "serviceId", "quantity")
    VALUES ($1, $2, $3, $4)
    RETURNING "id", "quantity", CAST("created_at" AS TEXT) AS created_at
"#;

const DB_DELETE_CART_ITEM: &str = r#"
    DELETE FROM cart_items WHERE "id" = $1 AND "userId" = $2
"#;

const DB_CLEAR_CART: &str = r#"
    DELETE FROM cart_items WHERE "userId" = $1
"#;

// --- checkout (single transaction) ------------------------------------------

const DB_CHECKOUT_LOCK_CART: &str = r#"
    SELECT ci."id", ci."userId", ci."productId", ci."serviceId", ci."quantity",
           p.name AS product_name, CAST(p.price AS TEXT) AS product_price,
           p.stock AS product_stock, s.name AS service_name,
           CAST(s.price AS TEXT) AS service_price
    FROM cart_items ci
    LEFT JOIN products p ON p."id" = ci."productId"
    LEFT JOIN business_services s ON s."id" = ci."serviceId"
    WHERE ci."userId" = $1
    ORDER BY ci."created_at" DESC
    FOR UPDATE
"#;

const DB_DECREASE_STOCK: &str = r#"
    UPDATE products SET "stock" = "stock" - $1 WHERE "id" = $2
"#;

const DB_INSERT_ORDER: &str = r#"
    INSERT INTO orders ("userId", "totalAmount", "currency", "status", "shippingAddress")
    VALUES ($1, $2, 'VND', 'PENDING', $3)
    RETURNING "id", CAST("created_at" AS TEXT) AS created_at
"#;

const DB_INSERT_ORDER_ITEM: &str = r#"
    INSERT INTO order_items ("orderId", "productId", "serviceId", "quantity", "priceAtPurchase")
    VALUES ($1, $2, $3, $4, $5)
"#;

const DB_INSERT_TRANSACTION: &str = r#"
    INSERT INTO business_transactions ("orderId", "paymentMethod", "status", "amount")
    VALUES ($1, $2, 'PENDING', $3)
    RETURNING "id"
"#;

// --- orders ------------------------------------------------------------------

const DB_SELECT_MY_ORDERS: &str = r#"
    SELECT "id", "userId", CAST("totalAmount" AS TEXT) AS total_amount, "currency",
           "status", "shippingAddress", CAST("created_at" AS TEXT) AS created_at
    FROM orders WHERE "userId" = $1 ORDER BY "created_at" DESC
"#;

const DB_SELECT_ORDER_ITEMS: &str = r#"
    SELECT oi."orderId", oi."id", oi."productId", oi."serviceId", oi."quantity",
           CAST(oi."priceAtPurchase" AS TEXT) AS price_at_purchase,
           p.name AS product_name, s.name AS service_name
    FROM order_items oi
    LEFT JOIN products p ON p."id" = oi."productId"
    LEFT JOIN business_services s ON s."id" = oi."serviceId"
    WHERE oi."orderId" = ANY($1::uuid[])
"#;

const DB_SELECT_VENDOR_ORDERS: &str = r#"
    SELECT oi."id", oi."orderId", oi."productId", oi."serviceId", oi."quantity",
           CAST(oi."priceAtPurchase" AS TEXT) AS price_at_purchase,
           o."userId" AS buyer_id, o."status", o."shippingAddress",
           CAST(o."created_at" AS TEXT) AS created_at,
           p.name AS product_name, s.name AS service_name
    FROM order_items oi
    JOIN orders o ON o."id" = oi."orderId"
    LEFT JOIN products p ON p."id" = oi."productId"
    LEFT JOIN business_services s ON s."id" = oi."serviceId"
    WHERE p."business_profile_id" = $1 OR s."business_profile_id" = $1
    ORDER BY o."created_at" DESC
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ProfileForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub industry: Option<String>,
    pub website: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProductForm {
    pub name: String,
    pub description: Option<String>,
    pub price: String,
    pub currency: Option<String>,
    pub category: Option<String>,
    pub stock: Option<i64>,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProductForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price: Option<String>,
    pub currency: Option<String>,
    pub category: Option<String>,
    pub stock: Option<i64>,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateServiceForm {
    pub name: String,
    pub description: Option<String>,
    pub price: String,
    pub currency: Option<String>,
    pub category: Option<String>,
    pub duration: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateServiceForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price: Option<String>,
    pub currency: Option<String>,
    pub category: Option<String>,
    pub duration: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReviewForm {
    pub rating: i64,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CartAddForm {
    pub item_id: String,
    pub item_type: String,
    pub quantity: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CheckoutForm {
    pub shipping_address: String,
    pub payment_method: String,
}

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

fn profile_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "user_id": row.get::<Option<String>>("user_id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "industry": row.get::<Option<String>>("industry"),
        "website": row.get::<Option<String>>("website"),
        "logo_url": row.get::<Option<String>>("logo_url"),
        "address": row.get::<Option<String>>("address"),
        "lat": row.get::<Option<String>>("lat"),
        "lng": row.get::<Option<String>>("lng"),
        "is_verified": row.get::<bool>("is_verified"),
        "products_count": row.get::<i64>("products_count"),
        "services_count": row.get::<i64>("services_count"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn product_to_json(row: &sqlx::Row, reviews: Vec<Value>) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "price": row.get::<String>("price"),
        "currency": row.get::<Option<String>>("currency"),
        "category": row.get::<Option<String>>("category"),
        "stock": row.get::<i64>("stock"),
        "image_url": row.get::<Option<String>>("image_url"),
        "business_profile_id": row.get::<String>("business_profile_id"),
        "reviews": reviews,
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn product_list_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "price": row.get::<String>("price"),
        "currency": row.get::<Option<String>>("currency"),
        "category": row.get::<Option<String>>("category"),
        "stock": row.get::<i64>("stock"),
        "image_url": row.get::<Option<String>>("image_url"),
        "business_profile_id": row.get::<String>("business_profile_id"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn service_to_json(row: &sqlx::Row, reviews: Vec<Value>) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "price": row.get::<String>("price"),
        "currency": row.get::<Option<String>>("currency"),
        "category": row.get::<Option<String>>("category"),
        "duration": row.get::<Option<String>>("duration"),
        "location": row.get::<Option<String>>("location"),
        "business_profile_id": row.get::<String>("business_profile_id"),
        "reviews": reviews,
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn service_list_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "name": row.get::<String>("name"),
        "description": row.get::<Option<String>>("description"),
        "price": row.get::<String>("price"),
        "currency": row.get::<Option<String>>("currency"),
        "category": row.get::<Option<String>>("category"),
        "duration": row.get::<Option<String>>("duration"),
        "location": row.get::<Option<String>>("location"),
        "business_profile_id": row.get::<String>("business_profile_id"),
        "created_at": row.get::<String>("created_at"),
        "updated_at": row.get::<String>("updated_at"),
    })
}

fn review_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "user_id": row.get::<String>("user_id"),
        "user_name": row.get::<Option<String>>("full_name"),
        "rating": row.get::<i64>("rating"),
        "comment": row.get::<Option<String>>("comment"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn cart_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "user_id": row.get::<String>("userId"),
        "product_id": row.get::<Option<String>>("productId"),
        "service_id": row.get::<Option<String>>("serviceId"),
        "quantity": row.get::<i64>("quantity"),
        "product_name": row.get::<Option<String>>("product_name"),
        "product_price": row.get::<Option<String>>("product_price"),
        "product_image": row.get::<Option<String>>("product_image"),
        "service_name": row.get::<Option<String>>("service_name"),
        "service_price": row.get::<Option<String>>("service_price"),
        "created_at": row.get::<String>("created_at"),
    })
}

fn order_to_json(order_row: &sqlx::Row, items: Vec<Value>) -> Value {
    serde_json::json!({
        "id": order_row.get::<String>("id"),
        "user_id": order_row.get::<String>("userId"),
        "total_amount": order_row.get::<String>("total_amount"),
        "currency": order_row.get::<Option<String>>("currency"),
        "status": order_row.get::<String>("status"),
        "shipping_address": order_row.get::<Option<String>>("shippingAddress"),
        "created_at": order_row.get::<String>("created_at"),
        "items": items,
    })
}

fn vendor_order_item_to_json(row: &sqlx::Row) -> Value {
    serde_json::json!({
        "id": row.get::<String>("id"),
        "order_id": row.get::<String>("orderId"),
        "product_id": row.get::<Option<String>>("productId"),
        "service_id": row.get::<Option<String>>("serviceId"),
        "quantity": row.get::<i64>("quantity"),
        "price_at_purchase": row.get::<String>("price_at_purchase"),
        "buyer_id": row.get::<String>("buyer_id"),
        "status": row.get::<String>("status"),
        "shipping_address": row.get::<Option<String>>("shippingAddress"),
        "created_at": row.get::<String>("created_at"),
        "product_name": row.get::<Option<String>>("product_name"),
        "service_name": row.get::<Option<String>>("service_name"),
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Lấy danh sách đánh giá của một sản phẩm/dịch vụ (kèm tên người đánh giá).
async fn fetch_reviews(
    pool: &DbPool,
    kind: &str,
    item_id: &str,
) -> Result<Vec<Value>, AppError> {
    let sql = match kind {
        "product" => DB_SELECT_PRODUCT_REVIEWS,
        _ => DB_SELECT_SERVICE_REVIEWS,
    };
    let rows = sqlx::query(sql)
        .bind(item_id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(rows.iter().map(review_to_json).collect())
}

/// Từ chối các trường trống/whitespace (tương đương `@IsNotEmpty`).
fn is_blank(s: Option<&String>) -> bool {
    s.as_ref().map(|v| v.trim().is_empty()).unwrap_or(true)
}

// ---------------------------------------------------------------------------
// Handlers — business_profiles
// ---------------------------------------------------------------------------

/// `GET /api/business` — danh sách tất cả hồ sơ doanh nghiệp liên kết.
pub async fn get_profiles(State(pool): State<DbPool>) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_PROFILES)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "profiles": rows.iter().map(profile_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

/// `GET /api/business/:id/profile` — chi tiết hồ sơ doanh nghiệp.
pub async fn get_profile(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_PROFILE_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "profile": profile_to_json(&r),
            "active_sponsorships": vec![
                "Nhà tài trợ vàng cuộc thi EduMap Hackathon 2026",
                "Tài trợ thiết bị tin học phòng Lab trường THPT Chuyên",
                "Tài trợ 20 suất học bổng xanh Green Campus",
            ],
            "rating": 4.9,
        })))),
        None => Err(AppError::NotFound("Doanh nghiệp không tồn tại.".to_string())),
    }
}

/// `POST /api/business/profile` — tạo mới hoặc cập nhật hồ sơ doanh nghiệp.
pub async fn create_or_update_profile(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<ProfileForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if is_blank(form.name.as_ref()) {
        return Err(AppError::BadRequest("Tên doanh nghiệp là bắt buộc.".to_string()));
    }

    let existing = sqlx::query(DB_SELECT_PROFILE_BY_USER)
        .bind(&user.id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    // Cập nhật: old service chỉ ghi đè name / description / industry /
    // website / logo_url; address / lat / lng giữ nguyên.
    if existing.is_some() {
        sqlx::query(DB_UPDATE_PROFILE)
            .bind(form.name.as_deref())
            .bind(form.description.as_deref())
            .bind(form.industry.as_deref())
            .bind(form.website.as_deref())
            .bind(form.logo_url.as_deref())
            .bind(&user.id)
            .execute(pool.db())
            .await
            .map_err(to_app_error)?;
    } else {
        // Tạo mới: `is_verified = false`, chờ admin/moderator xác minh.
        sqlx::query(DB_INSERT_PROFILE)
            .bind(&user.id)
            .bind(form.name.as_deref().unwrap())
            .bind(form.description.as_deref())
            .bind(form.industry.as_deref())
            .bind(form.website.as_deref())
            .bind(form.logo_url.as_deref())
            .bind::<Option<String>>(None) // address
            .bind::<Option<String>>(None) // lat
            .bind::<Option<String>>(None) // lng
            .bind(false)
            .execute(pool.db())
            .await
            .map_err(to_app_error)?;
    }

    // Trả lại toàn bộ hồ sơ (giống old service trả về entity đã save).
    let row = sqlx::query(DB_SELECT_PROFILE_BY_USER)
        .bind(&user.id)
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "profile": profile_to_json(&row),
        "message": if existing.is_some() {
            "Cập nhật hồ sơ doanh nghiệp thành công."
        } else {
            "Tạo hồ sơ doanh nghiệp thành công. Chờ xác minh."
        },
        "is_verified": row.get::<bool>("is_verified"),
    }))))
}

/// `POST /api/business/:id/verify` — xác minh hồ sơ (dành cho quản trị viên).
pub async fn verify_profile(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    let row = sqlx::query(DB_VERIFY_PROFILE)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Xác minh hồ sơ doanh nghiệp thành công.",
            "id": r.get::<String>("id"),
            "is_verified": r.get::<bool>("is_verified"),
            "updated_at": r.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound("Doanh nghiệp không tồn tại.".to_string())),
    }
}

// ---------------------------------------------------------------------------
// Handlers — products
// ---------------------------------------------------------------------------

/// `POST /api/business/:bpId/products` — tạo sản phẩm mới.
pub async fn create_product(
    State(pool): State<DbPool>,
    req: Request,
    Path(bp_id): Path<String>,
    Json(form): Json<CreateProductForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    if is_blank(form.name.as_ref()) || is_blank(Some(&form.price)) {
        return Err(AppError::BadRequest("Tên sản phẩm và giá là bắt buộc.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_PRODUCT)
        .bind(&form.name)
        .bind(form.description.as_deref())
        .bind(&form.price)
        .bind(form.currency.as_deref().unwrap_or("VND"))
        .bind(form.category.as_deref())
        .bind(form.stock.unwrap_or(0))
        .bind(form.image_url.as_deref())
        .bind(&bp_id)
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Tạo sản phẩm thành công.",
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/business/:bpId/products` — danh sách sản phẩm của một hồ sơ.
pub async fn get_products(
    State(pool): State<DbPool>,
    Path(bp_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_PRODUCTS)
        .bind(&bp_id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "products": rows.iter().map(product_list_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

/// `GET /api/business/products/:id` — chi tiết sản phẩm theo ID.
pub async fn get_product(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_PRODUCT_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => {
            let reviews = fetch_reviews(pool, "product", &id).await?;
            Ok(Json(ApiResponse::ok(product_to_json(&r, reviews))))
        }
        None => Err(AppError::NotFound("Sản phẩm không tồn tại.".to_string())),
    }
}

/// `PUT /api/business/:bpId/products/:id` — cập nhật sản phẩm.
pub async fn update_product(
    State(pool): State<DbPool>,
    req: Request,
    Path((bp_id, id)): Path<(String, String)>,
    Json(form): Json<UpdateProductForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    let row = sqlx::query(DB_UPDATE_PRODUCT)
        .bind(form.name.as_deref())
        .bind(form.description.as_deref())
        .bind(form.price.as_deref())
        .bind(form.currency.as_deref())
        .bind(form.category.as_deref())
        .bind(form.stock)
        .bind(form.image_url.as_deref())
        .bind(&id)
        .bind(&bp_id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Cập nhật sản phẩm thành công.",
            "id": r.get::<String>("id"),
            "updated_at": r.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound("Sản phẩm không tồn tại.".to_string())),
    }
}

/// `DELETE /api/business/:bpId/products/:id` — xóa sản phẩm.
pub async fn delete_product(
    State(pool): State<DbPool>,
    req: Request,
    Path((bp_id, id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    let res = sqlx::query(DB_DELETE_PRODUCT)
        .bind(&id)
        .bind(&bp_id)
        .execute(pool.db())
        .await
        .map_err(to_app_error)?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Sản phẩm không tồn tại.".to_string()));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Sản phẩm đã được xóa thành công.",
    }))))
}

// ---------------------------------------------------------------------------
// Handlers — business_services
// ---------------------------------------------------------------------------

/// `POST /api/business/:bpId/services` — tạo dịch vụ mới.
pub async fn create_service(
    State(pool): State<DbPool>,
    req: Request,
    Path(bp_id): Path<String>,
    Json(form): Json<CreateServiceForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    if is_blank(form.name.as_ref()) || is_blank(Some(&form.price)) {
        return Err(AppError::BadRequest("Tên dịch vụ và giá là bắt buộc.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_SERVICE)
        .bind(&form.name)
        .bind(form.description.as_deref())
        .bind(&form.price)
        .bind(form.currency.as_deref().unwrap_or("VND"))
        .bind(form.category.as_deref())
        .bind(form.duration.as_deref())
        .bind(form.location.as_deref())
        .bind(&bp_id)
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Tạo dịch vụ thành công.",
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/business/:bpId/services` — danh sách dịch vụ của một hồ sơ.
pub async fn get_services(
    State(pool): State<DbPool>,
    Path(bp_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_SERVICES)
        .bind(&bp_id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "services": rows.iter().map(service_list_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

/// `GET /api/business/services/:id` — chi tiết dịch vụ theo ID.
pub async fn get_service(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_SERVICE_BY_ID)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => {
            let reviews = fetch_reviews(pool, "service", &id).await?;
            Ok(Json(ApiResponse::ok(service_to_json(&r, reviews))))
        }
        None => Err(AppError::NotFound("Dịch vụ không tồn tại.".to_string())),
    }
}

/// `PUT /api/business/:bpId/services/:id` — cập nhật dịch vụ.
pub async fn update_service(
    State(pool): State<DbPool>,
    req: Request,
    Path((bp_id, id)): Path<(String, String)>,
    Json(form): Json<UpdateServiceForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    let row = sqlx::query(DB_UPDATE_SERVICE)
        .bind(form.name.as_deref())
        .bind(form.description.as_deref())
        .bind(form.price.as_deref())
        .bind(form.currency.as_deref())
        .bind(form.category.as_deref())
        .bind(form.duration.as_deref())
        .bind(form.location.as_deref())
        .bind(&id)
        .bind(&bp_id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    match row {
        Some(r) => Ok(Json(ApiResponse::ok(serde_json::json!({
            "message": "Cập nhật dịch vụ thành công.",
            "id": r.get::<String>("id"),
            "updated_at": r.get::<String>("updated_at"),
        })))),
        None => Err(AppError::NotFound("Dịch vụ không tồn tại.".to_string())),
    }
}

/// `DELETE /api/business/:bpId/services/:id` — xóa dịch vụ.
pub async fn delete_service(
    State(pool): State<DbPool>,
    req: Request,
    Path((bp_id, id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_owner(pool, &bp_id, &user).await?;

    let res = sqlx::query(DB_DELETE_SERVICE)
        .bind(&id)
        .bind(&bp_id)
        .execute(pool.db())
        .await
        .map_err(to_app_error)?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Dịch vụ không tồn tại.".to_string()));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Dịch vụ đã được xóa thành công.",
    }))))
}

// ---------------------------------------------------------------------------
// Handlers — reviews
// ---------------------------------------------------------------------------

/// `POST /api/business/products/:id/reviews` — đánh giá sản phẩm.
pub async fn create_product_review(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(form): Json<ReviewForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if !(1..=5).contains(&form.rating) {
        return Err(AppError::BadRequest("Đánh giá phải từ 1 đến 5 sao.".to_string()));
    }

    let exists = sqlx::query(DB_CHECK_REVIEW)
        .bind(&user.id)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    if exists.is_some() {
        return Err(AppError::Conflict("Bạn đã gửi đánh giá cho mục này rồi.".to_string()));
    }

    // Xác nhận sản phẩm tồn tại (giống old service).
    let product = sqlx::query(r#"SELECT "id" FROM products WHERE "id" = $1"#)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    if product.is_none() {
        return Err(AppError::NotFound("Sản phẩm không tồn tại.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_REVIEW)
        .bind(&user.id)
        .bind::<Option<String>>(Some(id.clone()))
        .bind::<Option<String>>(None)
        .bind(form.rating)
        .bind(form.comment.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Đánh giá sản phẩm thành công.",
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/business/products/:id/reviews` — danh sách đánh giá sản phẩm.
pub async fn get_product_reviews(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_PRODUCT_REVIEWS)
        .bind(&id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "reviews": rows.iter().map(review_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

/// `POST /api/business/services/:id/reviews` — đánh giá dịch vụ.
pub async fn create_service_review(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
    Json(form): Json<ReviewForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if !(1..=5).contains(&form.rating) {
        return Err(AppError::BadRequest("Đánh giá phải từ 1 đến 5 sao.".to_string()));
    }

    let exists = sqlx::query(DB_CHECK_REVIEW)
        .bind(&user.id)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    if exists.is_some() {
        return Err(AppError::Conflict("Bạn đã gửi đánh giá cho mục này rồi.".to_string()));
    }

    let service = sqlx::query(r#"SELECT "id" FROM business_services WHERE "id" = $1"#)
        .bind(&id)
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    if service.is_none() {
        return Err(AppError::NotFound("Dịch vụ không tồn tại.".to_string()));
    }

    let row = sqlx::query(DB_INSERT_REVIEW)
        .bind(&user.id)
        .bind::<Option<String>>(None)
        .bind::<Option<String>>(Some(id.clone()))
        .bind(form.rating)
        .bind(form.comment.as_deref())
        .fetch_one(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Đánh giá dịch vụ thành công.",
        "id": row.get::<String>("id"),
        "created_at": row.get::<String>("created_at"),
    }))))
}

/// `GET /api/business/services/:id/reviews` — danh sách đánh giá dịch vụ.
pub async fn get_service_reviews(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let rows = sqlx::query(DB_SELECT_SERVICE_REVIEWS)
        .bind(&id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "reviews": rows.iter().map(review_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

// ---------------------------------------------------------------------------
// Handlers — cart
// ---------------------------------------------------------------------------

/// `GET /api/business/cart` — nội dung giỏ hàng của người dùng.
pub async fn get_cart(State(pool): State<DbPool>, req: Request) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let rows = sqlx::query(DB_SELECT_CART)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "items": rows.iter().map(cart_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}

/// `POST /api/business/cart/add` — thêm sản phẩm/dịch vụ vào giỏ (cộng dồn
// quantity nếu mục đã tồn tại).
pub async fn add_to_cart(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CartAddForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let (product_id, service_id) = match form.item_type.as_str() {
        "product" => (Some(form.item_id.clone()), None),
        "service" => (None, Some(form.item_id.clone())),
        _ => {
            return Err(AppError::BadRequest(
                "item_type phải là 'product' hoặc 'service'.".to_string(),
            ))
        }
    };

    let quantity = form.quantity.unwrap_or(1);
    if quantity <= 0 {
        return Err(AppError::BadRequest("quantity phải lớn hơn 0.".to_string()));
    }

    let existing = sqlx::query(DB_SELECT_CART_ITEM)
        .bind(&user.id)
        .bind(product_id.as_deref())
        .bind(service_id.as_deref())
        .fetch_optional(pool.db())
        .await
        .map_err(to_app_error)?;

    let row = match existing {
        Some(r) => {
            let new_qty = r.get::<i64>("quantity") + quantity;
            sqlx::query(DB_UPDATE_CART_QUANTITY)
                .bind(new_qty)
                .bind::<String>(r.get("id"))
                .bind(&user.id)
                .fetch_one(pool.db())
                .await
                .map_err(to_app_error)?
        }
        None => sqlx::query(DB_INSERT_CART_ITEM)
            .bind(&user.id)
            .bind(product_id.as_deref())
            .bind(service_id.as_deref())
            .bind(quantity)
            .fetch_one(pool.db())
            .await
            .map_err(to_app_error)?,
    };

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Thêm vào giỏ hàng thành công.",
        "id": row.get::<String>("id"),
        "quantity": row.get::<i64>("quantity"),
    }))))
}

/// `DELETE /api/business/cart/:id` — xóa một mục khỏi giỏ.
pub async fn remove_from_cart(
    State(pool): State<DbPool>,
    req: Request,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let res = sqlx::query(DB_DELETE_CART_ITEM)
        .bind(&id)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(to_app_error)?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("Mục trong giỏ hàng không tồn tại.".to_string()));
    }
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Xóa mục khỏi giỏ hàng thành công.",
    }))))
}

/// `DELETE /api/business/cart` — xóa toàn bộ giỏ hàng.
pub async fn clear_cart(State(pool): State<DbPool>, req: Request) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    sqlx::query(DB_CLEAR_CART)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Giỏ hàng đã được xóa.",
    }))))
}

// ---------------------------------------------------------------------------
// Handlers — checkout
// ---------------------------------------------------------------------------

/// `POST /api/business/checkout` — thanh toán và tạo đơn hàng trong một
// giao dịch Postgres duy nhất: khóa các dòng giỏ hàng (`FOR UPDATE`), kiểm
// tồn kho, trừ stock, ghi `orders` + `order_items` + `business_transactions`,
// xóa giỏ, commit. Bất kỳ bước nào thất bại → rollback.
pub async fn checkout(
    State(pool): State<DbPool>,
    req: Request,
    Json(form): Json<CheckoutForm>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    if is_blank(Some(&form.shipping_address)) {
        return Err(AppError::BadRequest("Địa chỉ nhận hàng là bắt buộc.".to_string()));
    }
    if is_blank(Some(&form.payment_method)) {
        return Err(AppError::BadRequest("Phương thức thanh toán là bắt buộc.".to_string()));
    }

    let mut tx = match pool.db().begin().await {
        Ok(tx) => tx,
        Err(e) => return Err(to_app_error(e)),
    };

    let cart_rows = sqlx::query(DB_CHECKOUT_LOCK_CART)
        .bind(&user.id)
        .fetch_all(&mut *tx)
        .await
        .map_err(to_app_error)?;

    if cart_rows.is_empty() {
        let _ = tx.rollback().await;
        return Err(AppError::BadRequest("Giỏ hàng trống.".to_string()));
    }

    let mut total_amount = 0.0f64;
    let mut order_items = Vec::new();

    for row in &cart_rows {
        let product_id: Option<String> = row.get("productId");
        let service_id: Option<String> = row.get("serviceId");
        let quantity: i64 = row.get("quantity");

        if let Some(pid) = product_id {
            let stock: i64 = row.get("product_stock");
            if stock < quantity {
                let name: String = row.get("product_name");
                let _ = tx.rollback().await;
                return Err(AppError::BadRequest(format!(
                    "Sản phẩm {} không đủ tồn kho.",
                    name
                )));
            }
            sqlx::query(DB_DECREASE_STOCK)
                .bind(quantity)
                .bind(&pid)
                .execute(&mut *tx)
                .await
                .map_err(to_app_error)?;

            let price: Option<String> = row.get("product_price");
            let price_f64 = price.and_then(|p| p.parse::<f64>().ok()).unwrap_or(0.0);
            total_amount += price_f64 * quantity as f64;
            order_items.push((Some(pid), None, quantity, price.unwrap_or_default()));
        } else if let Some(sid) = service_id {
            let price: Option<String> = row.get("service_price");
            let price_f64 = price.and_then(|p| p.parse::<f64>().ok()).unwrap_or(0.0);
            total_amount += price_f64 * quantity as f64;
            order_items.push((None, Some(sid), quantity, price.unwrap_or_default()));
        }
    }

    let order_row = sqlx::query(DB_INSERT_ORDER)
        .bind(&user.id)
        .bind(&format!("{:.2}", total_amount))
        .bind(&form.shipping_address)
        .fetch_one(&mut *tx)
        .await
        .map_err(to_app_error)?;

    let order_id: String = order_row.get("id");

    for (pid, sid, qty, price_str) in order_items {
        sqlx::query(DB_INSERT_ORDER_ITEM)
            .bind(&order_id)
            .bind(pid.as_deref())
            .bind(sid.as_deref())
            .bind(qty)
            .bind(&price_str)
            .execute(&mut *tx)
            .await
            .map_err(to_app_error)?;
    }

    sqlx::query(DB_INSERT_TRANSACTION)
        .bind(&order_id)
        .bind(&form.payment_method)
        .bind(&format!("{:.2}", total_amount))
        .execute(&mut *tx)
        .await
        .map_err(to_app_error)?;

    sqlx::query(DB_CLEAR_CART)
        .bind(&user.id)
        .execute(&mut *tx)
        .await
        .map_err(to_app_error)?;

    if let Err(e) = tx.commit().await {
        return Err(to_app_error(e));
    }

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "message": "Đặt hàng thành công.",
        "order_id": order_id,
        "total_amount": format!("{:.2}", total_amount),
    }))))
}

// ---------------------------------------------------------------------------
// Handlers — orders
// ---------------------------------------------------------------------------

/// `GET /api/business/orders/me` — lịch sử đơn hàng của người dùng.
pub async fn get_my_orders(State(pool): State<DbPool>, req: Request) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;

    let rows = sqlx::query(DB_SELECT_MY_ORDERS)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;

    let order_ids: Vec<Uuid> = rows
        .iter()
        .filter_map(|r| r.get::<String>("id").parse().ok())
        .collect();

    let items_by_order: Vec<Vec<Value>> = if order_ids.is_empty() {
        Vec::new()
    } else {
        let item_rows = sqlx::query(DB_SELECT_ORDER_ITEMS)
            .bind(&order_ids)
            .fetch_all(pool.db())
            .await
            .map_err(to_app_error)?;

        let mut by_order: std::collections::HashMap<String, Vec<Value>> =
            std::collections::HashMap::new();
        for r in &item_rows {
            let order_id: String = r.get("orderId");
            by_order.entry(order_id).or_default().push(serde_json::json!({
                "id": r.get::<String>("id"),
                "product_id": r.get::<Option<String>>("productId"),
                "service_id": r.get::<Option<String>>("serviceId"),
                "quantity": r.get::<i64>("quantity"),
                "price_at_purchase": r.get::<String>("price_at_purchase"),
                "product_name": r.get::<Option<String>>("product_name"),
                "service_name": r.get::<Option<String>>("service_name"),
            }));
        }
        rows.iter()
            .map(|r| by_order.remove(&r.get::<String>("id")).unwrap_or_default())
            .collect()
    };

    let orders: Vec<Value> = rows
        .iter()
        .zip(items_by_order)
        .map(|(r, items)| order_to_json(r, items))
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "orders": orders,
        "total": rows.len() as i64,
    }))))
}

/// `GET /api/business/orders/vendor` — danh sách đơn hàng của doanh nghiệp.
pub async fn get_vendor_orders(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let user = authenticated_user(&req)?;
    let profile_id = user_business_profile(pool, &user).await?;

    let rows = sqlx::query(DB_SELECT_VENDOR_ORDERS)
        .bind(&profile_id)
        .fetch_all(pool.db())
        .await
        .map_err(to_app_error)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "orders": rows.iter().map(vendor_order_item_to_json).collect::<Vec<_>>(),
        "total": rows.len() as i64,
    }))))
}