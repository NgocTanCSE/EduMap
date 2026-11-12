//! Certificate module — `/api/certificates/*`: cấp chứng nhận số, xác thực
//! chứng nhận, hồ sơ năng lực và tải PDF chứng nhận.
//!
//! Mirrors `backend/src/modules/certificate/certificate.controller.ts` +
//! `certificate.service.ts`. Dữ liệu mới lives in `certificate_templates` +
//! `user_certificates` (bảng `certificates` legacy bị bỏ).
//!
//! Tất cả SQL dùng runtime API (`query!` cần DB khi compile).

use crate::common::auth::AuthUser;
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE};
use axum::http::{Request<Body>, Response<Body>};
use axum::Json;
use axum::response::IntoResponse;
use chrono::Utc;
use image::Luma;
use printpdf::*;
use qrcode::QrCode;
use serde::Deserialize;
use std::io::{BufWriter, Cursor};
use std::sync::atomic::{AtomicU64, Ordering};
use tracing::warn;

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------

/// Tìm một chứng nhận theo mã xác thực (kèm người dùng, mẫu và tổ chức).
const DB_SELECT_CERT_BY_CODE: &str = r#"
    SELECT uc.id, uc.user_id, uc.template_id,
           CAST(uc.issued_at AS TEXT) AS issued_at,
           uc.verify_code, uc.qr_url, uc.pdf_url,
           CAST(uc.blockchain_metadata AS TEXT) AS blockchain_metadata,
           uc.status, uc.created_at,
           u.full_name,
           t.name AS template_name,
           t.type AS template_type,
           o.name AS organization_name
    FROM user_certificates uc
    JOIN users u ON u.id = uc.user_id
    JOIN certificate_templates t ON t.id = uc.template_id
    LEFT JOIN organizations o ON o.id = t.organization_id
    WHERE uc.verify_code = $1
"#;

/// Kiểm tra người dùng đã sở hữu chứng chỉ của mẫu này chưa.
const DB_SELECT_EXISTING_CERT: &str = r#"
    SELECT id FROM user_certificates
    WHERE user_id = $1 AND template_id = $2
"#;

/// Kiểm tra mẫu chứng nhận tồn tại (và lấy tên để gửi sang blockchain).
const DB_SELECT_TEMPLATE: &str = r#"
    SELECT id, name FROM certificate_templates WHERE id = $1
"#;

/// Cấp mã xác thực mới.
const DB_INSERT_CERTIFICATE: &str = r#"
    INSERT INTO user_certificates
        (id, user_id, template_id, issued_at, verify_code,
         blockchain_metadata, pdf_url, qr_url, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id,
            verify_code,
            CAST(issued_at AS TEXT) AS issued_at,
            blockchain_metadata,
            pdf_url,
            qr_url,
            status
"#;

/// Hồ sơ năng lực: các chứng nhận còn hiệu lực của người dùng.
const DB_SELECT_PORTFOLIO: &str = r#"
    SELECT uc.id, uc.user_id, uc.template_id,
           CAST(uc.issued_at AS TEXT) AS issued_at,
           uc.verify_code, uc.qr_url, uc.pdf_url,
           uc.status, uc.created_at,
           u.full_name,
           t.name AS template_name,
           t.type AS template_type,
           o.name AS organization_name
    FROM user_certificates uc
    JOIN users u ON u.id = uc.user_id
    JOIN certificate_templates t ON t.id = uc.template_id
    LEFT JOIN organizations o ON o.id = t.organization_id
    WHERE uc.user_id = $1 AND uc.status = 'active'
    ORDER BY uc.issued_at DESC
"#;

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// `POST /api/certificates/issue` body (old backend: camelCase `userId`).
#[derive(Debug, Clone, Deserialize)]
pub struct IssueCertificateBody {
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: String,
    #[serde(rename = "templateId", alias = "template_id")]
    pub template_id: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Binary alphabet cho mã xác thực (0-9, A-Z).
const BASE36_ALPHABET: &str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Mã hóa một số thành base-36 (chữ hoa).
fn to_base36(mut value: u64) -> String {
    if value == 0 {
        return String::from("0");
    }
    let mut chars = Vec::new();
    while value > 0 {
        chars.push(BASE36_ALPHABET[(value % 36) as usize]);
        value /= 36;
    }
    chars.into_iter().rev().collect()
}

/// Tạo mã xác thực dạng `CERT-{millis base36}-{4 ký tự base36}`.
///
/// Giống cũ backend (`Date.now().toString(36) + Math.random().toString(36)`),
/// nhưng không phụ thuộc vào `rand` (chưa có trong Cargo.toml).
fn generate_verify_code() -> String {
    static SEED: AtomicU64 = AtomicU64::new(0);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_millis() as u64;

    //Seed thay đổi theo thời gian + bộ đếm để tránh trùng trong cùng mili giây.
    let mixed = now ^ SEED.fetch_add(1, Ordering::Relaxed);
    let rand = (mixed & 0x0000_FFFF_FFFF_F000) >> 12;

    format!(
        "CERT-{}-{:0>4}",
        to_base36(now),
        to_base36(rand % (36 * 36 * 36 * 36))
    )
}

/// Người dùng đã đăng nhập (các route cần JWT).
fn authenticated_user(req: &Request) -> Result<AuthUser, AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
}

/// Admin hoặc moderator mới được cấp chứng chỉ.
fn ensure_admin(user: &AuthUser) -> Result<(), AppError> {
    if !matches!(user.role.as_str(), "admin" | "moderator") {
        return Err(AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

/// Ký số chứng chỉ qua module blockchain.
fn sign_with_blockchain(
    user_id: &str,
    cert_code: &str,
    template_name: &str,
) -> Option<serde_json::Value> {
    Some(crate::modules::blockchain::sign_certificate(user_id, cert_code, template_name))
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

pub fn router(pool: DbPool) -> axum::Router {
    axum::Router::new()
        .route("/api/certificates/issue", post(issue_certificate))
        .route("/api/certificates/verify/:code", get(verify_certificate))
        .route("/api/certificates/portfolio", get(get_portfolio))
        .route("/api/certificates/download/:code.pdf", get(download_certificate_pdf))
        .with_state(pool)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `POST /api/certificates/issue` — admin/moderator cấp chứng nhận số mới.
///
/// Body: `{ "userId": "...", "templateId": "..." }`.
/// - Template không tồn tại → `404 NotFound`.
/// - Người dùng đã sở hữu chứng chỉ này → `400 BadRequest`.
/// - Gọi `POST /api/blockchain/sign` để ký số; nếu blockchain chưa port
///   (`module` chưa có trong Rust), `blockchain_metadata = null` và
///   `degraded = true`.
pub async fn issue_certificate(
    State(pool): State<DbPool>,
    req: Request,
    Json(body): Json<IssueCertificateBody>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;
    ensure_admin(&user)?;

    if body.user_id.is_empty() || body.template_id.is_empty() {
        return Err(AppError::BadRequest(
            "userId và templateId không được để trống.".to_string(),
        ));
    }

    let template = sqlx::query(DB_SELECT_TEMPLATE)
        .bind(&body.template_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let template = match template {
        Some(row) => row,
        None => {
            return Err(AppError::NotFound("Template không tồn tại".to_string()));
        }
    };

    let existing = sqlx::query(DB_SELECT_EXISTING_CERT)
        .bind(&body.user_id)
        .bind(&body.template_id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Người dùng đã sở hữu chứng chỉ này".to_string(),
        ));
    }

    let cert_code = generate_verify_code();
    let blockchain_metadata =
        sign_with_blockchain(&body.user_id, &cert_code, template.get::<String>("name"));

    let inserted = sqlx::query(DB_INSERT_CERTIFICATE)
        .bind(&uuid::Uuid::new_v4().to_string())
        .bind(&body.user_id)
        .bind(&body.template_id)
        .bind(&Utc::now())
        .bind(&cert_code)
        .bind(&blockchain_metadata)
        .bind(&format!("/api/certificates/download/{cert_code}.pdf"))
        .bind(&format!("/api/certificates/verify-qr/{cert_code}"))
        .bind(&"active".to_string())
        .fetch_one(pool.db())
        .await
        .map_err(AppError::from)?;

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "id": inserted.get::<String>("id"),
        "verify_code": inserted.get::<String>("verify_code"),
        "issued_at": inserted.get::<String>("issued_at"),
        "status": inserted.get::<String>("status"),
        "pdf_url": inserted.get::<Option<String>>("pdf_url"),
        "qr_url": inserted.get::<Option<String>>("qr_url"),
        "blockchain_metadata": inserted.get::<Option<serde_json::Value>>("blockchain_metadata"),
        "degraded": blockchain_metadata.is_none(),
    }))))
}

/// `GET /api/certificates/verify/:code` — xác thực chứng nhận (công khai).
///
/// Trả về `{ isValid, message, details }`. Mã sai → 200 + `isValid = false`
/// (không phải 404, để người quét mã không đoán được cấu trúc DB).
pub async fn verify_certificate(
    State(pool): State<DbPool>,
    Path(code): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let row = sqlx::query(DB_SELECT_CERT_BY_CODE)
        .bind(&code)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let cert = match row {
        Some(row) => row,
        None => {
            return Ok(Json(ApiResponse::ok(serde_json::json!({
                "isValid": false,
                "message": "Mã xác thực không chính xác."
            }))));
        }
    };

    let blockchain: Option<serde_json::Value> = cert
        .get::<Option<String>>("blockchain_metadata")
        .and_then(|s| s.parse::<serde_json::Value>().ok());

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "isValid": true,
        "message": "Chứng nhận hợp lệ!",
        "details": {
            "title": cert.get::<String>("template_name"),
            "recipient": cert.get::<Option<String>>("full_name"),
            "issued_at": cert.get::<String>("issued_at"),
            "blockchain": blockchain,
            "template_type": cert.get::<Option<String>>("template_type"),
            "organization_name": cert.get::<Option<String>>("organization_name"),
        }
    }))))
}

/// `GET /api/certificates/portfolio` — hồ sơ năng lực cá nhân (JWT).
///
/// Lỗi DB không làm 500: trả về `{ total: 0, certificates: [] }`.
pub async fn get_portfolio(
    State(pool): State<DbPool>,
    req: Request,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    let user = authenticated_user(&req)?;

    // Sai DB → trả về rỗng thay vì 500 (giống cũ service `getUserPortfolio`).
    let certs = match sqlx::query(DB_SELECT_PORTFOLIO)
        .bind(&user.id)
        .fetch_all(pool.db())
        .await
    {
        Ok(rows) => rows,
        Err(err) => {
            warn!("could not load user certificates: {}", err);
            return Ok(Json(ApiResponse::ok(serde_json::json!({
                "total": 0,
                "certificates": Vec::<serde_json::Value>::new()
            }))));
        }
    };

    let certificates: Vec<serde_json::Value> = certs
        .into_iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<String>("id"),
                "user_id": row.get::<String>("user_id"),
                "template_id": row.get::<String>("template_id"),
                "issued_at": row.get::<String>("issued_at"),
                "verify_code": row.get::<String>("verify_code"),
                "qr_url": row.get::<Option<String>>("qr_url"),
                "pdf_url": row.get::<Option<String>>("pdf_url"),
                "status": row.get::<String>("status"),
                "created_at": row.get::<String>("created_at"),
                "full_name": row.get::<Option<String>>("full_name"),
                "template_name": row.get::<String>("template_name"),
                "template_type": row.get::<String>("template_type"),
                "organization_name": row.get::<Option<String>>("organization_name"),
            })
        })
        .collect();

    Ok(Json(ApiResponse::ok(serde_json::json!({
        "total": certificates.len() as i64,
        "certificates": certificates,
    }))))
}

/// `GET /api/certificates/download/:code.pdf` — tải PDF chứng nhận (công khai).
///
/// Trả về nhị phân PDF với `Content-Type: application/pdf` và
/// `Content-Disposition: attachment`. Chứng chỉ không tìm thấy → 404.
pub async fn download_certificate_pdf(
    State(pool): State<DbPool>,
    Path(code): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let verify_code = code
        .strip_suffix(".pdf")
        .unwrap_or(&code)
        .to_string();

    let cert = sqlx::query(DB_SELECT_CERT_BY_CODE)
        .bind(&verify_code)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;

    let cert = match cert {
        Some(row) => row,
        None => return Err(AppError::NotFound("Chứng chỉ không tồn tại".to_string())),
    };

    let pdf = render_certificate_pdf(&cert)?;

    let mut response = Response::new(Body::from(pdf));
    let filename = format!("attachment; filename=certificate-{}.pdf", verify_code);

    response.headers_mut().insert(
        CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/pdf"),
    );
    response.headers_mut().insert(
        CONTENT_DISPOSITION,
        axum::http::HeaderValue::from_str(&filename)
            .map_err(|e| AppError::Internal(format!("không thể tạo header PDF: {}", e)))?,
    );
    response.headers_mut().insert(
        CONTENT_LENGTH,
        axum::http::HeaderValue::from(pdf.len()),
    );

    Ok(response)
}

// ---------------------------------------------------------------------------
// PDF generator (printpdf)
// ---------------------------------------------------------------------------

/// Khổ A4 nằm ngang (297 × 210 mm).
const PAGE_W: f64 = 297.0;
const PAGE_H: f64 = 210.0;
/// Viền cách mép (mm).
const MARGIN: f64 = 10.0;

/// Font TrueType nhúng — hỗ trợ đầy đủ dấu tiếng Việt (font chuẩn 14 của PDF
/// chỉ có WinAnsi, không đủ cho ă/đ/ơ/ư).
const FONT_BYTES: &[u8] = include_bytes!("./certificate/DejaVuSans.ttf");

/// Render một chứng nhận thành bộ nhớ đệm.
///
/// Bố cục giống cũ `certificate.service.ts`: viền vàng, tiêu đề căn giữa,
/// tên người nhận nổi bật, mã xác thực + QR code ở góc dưới phải.
fn render_certificate_pdf(row: &sqlx::PgRow) -> Result<Vec<u8>, AppError> {
    let (doc, page, layer) =
        PdfDocument::new("Chứng nhận EduMap", Mm(PAGE_W), Mm(PAGE_H), "Layer 1");
    let layer = doc.get_page(page).get_layer(layer);

    let mut font_cursor = Cursor::new(FONT_BYTES);
    let font = doc
        .add_external_font(&mut font_cursor)
        .map_err(|e| AppError::Internal(format!("không nạp được font: {}", e)))?;

    // Viền màu vàng (#eab308), dày 5 pt.
    let border = Line::from_iter(vec![
        Point::new(Mm(MARGIN), Mm(MARGIN)),
        Point::new(Mm(PAGE_W - MARGIN), Mm(MARGIN)),
        Point::new(Mm(PAGE_W - MARGIN), Mm(PAGE_H - MARGIN)),
        Point::new(Mm(MARGIN), Mm(PAGE_H - MARGIN)),
    ]);
    border.set_closed(true);
    border.set_stroke(true);
    border.set_fill(false);

    let gold = Color::Rgb(Rgb::new(234.0 / 256.0, 179.0 / 256.0, 8.0 / 256.0, None));
    let dark = Color::Rgb(Rgb::new(24.0 / 256.0, 24.0 / 256.0, 27.0 / 256.0, None));

    layer.set_outline_color(gold.clone());
    layer.set_outline_thickness(5.0);
    layer.add_shape(border);

    layer.set_fill_color(dark.clone());
    layer.begin_text_section();

    // Tiêu đề
    let title = "CHỨNG NHẬN HOÀN THÀNH";
    layer.set_font(&font, 40.0);
    layer.set_text_cursor(
        center_x(title, 40.0),
        Mm(155.0),
    );
    layer.write_text(title, &font);

    // Dòng trao tặng
    let subtitle = "Hệ thống Bản đồ Giáo dục EduMap Biên Hòa trân trọng trao tặng cho:";
    layer.set_font(&font, 20.0);
    layer.set_text_cursor(center_x(subtitle, 20.0), Mm(135.0));
    layer.write_text(subtitle, &font);

    // Tên người nhận (màu vàng, lớn)
    let recipient: String = row.get::<Option<String>>("full_name").unwrap_or_default();
    let recipient_name = if recipient.is_empty() {
        "Học viên EduMap".to_string()
    } else {
        recipient
    };
    layer.set_fill_color(gold.clone());
    layer.set_font(&font, 35.0);
    layer.set_text_cursor(center_x(&recipient_name, 35.0), Mm(110.0));
    layer.write_text(&recipient_name, &font);

    // Lý do
    layer.set_fill_color(dark.clone());
    layer.set_font(&font, 20.0);
    layer.set_text_cursor(
        center_x("Vì đã hoàn thành xuất sắc:", 20.0),
        Mm(85.0),
    );
    layer.write_text("Vì đã hoàn thành xuất sắc:", &font);

    // Tên mẫu chứng chỉ
    let template_name: String = row.get::<String>("template_name");
    layer.set_font(&font, 25.0);
    layer.set_text_cursor(center_x(&template_name, 25.0), Mm(70.0));
    layer.write_text(&template_name, &font);

    // Mã xác thực + ngày cấp
    layer.set_font(&font, 12.0);
    layer.set_text_cursor(Mm(30.0), Mm(38.0));
    layer.write_text(
        &format!("Mã xác thực: {}", row.get::<String>("verify_code")),
        &font,
    );
    layer.set_text_cursor(Mm(30.0), Mm(32.0));
    layer.write_text(
        &format!("Ngày cấp: {}", row.get::<String>("issued_at")),
        &font,
    );

    layer.end_text_section();

    // QR code: quét để xác thực online.
    let verify_code: String = row.get::<String>("verify_code");
    let qr_url = format!("https://edumap.vn/verify/{}", verify_code);
    let qr_code = QrCode::new(qr_url.as_bytes())
        .map_err(|e| AppError::Internal(format!("tạo QR thất bại: {}", e)))?;
    let qr_image = qr_code.render::<Luma<u8>>().build();
    let qr_image = Image::try_from(qr_image)
        .map_err(|e| AppError::Internal(format!("nhúng QR thất bại: {}", e)))?;

    let qr_size = 30.0;
    qr_image.add_to_layer(
        layer,
        ImageTransform {
            translate_x: Some(Mm(PAGE_W - MARGIN - qr_size)),
            translate_y: Some(Mm(60.0)),
            dpi: Some(150.0),
            ..Default::default()
        },
    );

    // Nhãn dưới mã QR (giống cũ `generateCertificatePdf`).
    layer.begin_text_section();
    layer.set_font(&font, 8.0);
    layer.set_text_cursor(Mm(PAGE_W - MARGIN - qr_size - 10.0), Mm(27.0));
    layer.write_text("Quét để xác thực", &font);
    layer.end_text_section();

    let mut out = Vec::new();
    doc.save(&mut BufWriter::new(Cursor::new(&mut out)))
        .map_err(|e| AppError::Internal(format!("lỗi tạo PDF: {}", e)))?;

    Ok(out)
}

/// Căn ngang một dòng văn bản (ước lượng độ rộng ký tự ≈ 0.55 × cỡ chữ).
fn center_x(text: &str, font_size: f64) -> Mm {
    let width_mm = text.chars().count() as f64 * font_size * 0.55 * 25.4 / 72.0;
    Mm((PAGE_W - width_mm) / 2.0)
}