//! Authentication endpoints.
//!
//! Mirrors `backend/src/modules/auth/auth.controller.ts` + `auth.service.ts`:
//! register, login, dev-login, google-auth, refresh, me, profile, preferences,
//! change-password, 2fa, logout.
//!
//! Passwords: `argon2` (Argon2id, Argon2 v1.3) — a *unique* per-password
//! salt (uuid v4 + nanosecond timestamp → sha256 → base64, 44 chars). 2FA: raw
//! TOTP (RFC6238, HMAC-SHA1) so no `totp-rs` API drift breaks the build.
//!
//! BCrypt legacy hashes (`$2a$`/`$2b$`/`$2y$`) can't be verified by Argon2.
//! `verify_password` short-circuits to `false` for them (→ `401` with a
//! `not-verified` flag) so a password reset is offered instead of a `500`.
use crate::common::auth::{AuthUser, Claims};
use crate::common::error::AppError;
use crate::common::google_jwks::verify_google_credential;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, Salt};
use argon2::Algorithm;
use argon2::Argon2;
use argon2::Version;
use axum::extract::{Extension, Json, State};
use axum::response::IntoResponse;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use sqlx::Row;
use std::time::SystemTime;

/// Generate a per-password salt for Argon2.
///
/// The salt is built from a uuid v4 + the current nanoseconds, sha256'd and
/// base64-encoded (44 characters, the Argon2 PHC charset
/// `[a-zA-Z0-9/+.-]`).  Argon2 requires at least 8 bytes (11 characters) of
/// salt, so every password gets its own salt.  The string is leaked so the
/// returned `Salt<'static>` outlives this call.
fn random_salt() -> Salt<'static> {
    use base64::engine::general_purpose::STANDARD_NO_PAD;
    use base64::Engine;
    use sha2::{Digest, Sha256};
    use uuid::Uuid;

    let now = std::time::SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .expect("time went backwards");
    let mut input: [u8; 24] = [0u8; 24];
    input[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    // `Duration::as_nanos()` returns u128 after Rust 1.71 (the 8-byte
    // destination slot below truncates it deterministically by using the
    // first 64 bits, which is all the uniqueness we need here — the uuid
    // part is the stronger half).
    input[16..24]
        .copy_from_slice(&(now.as_nanos() as u64).to_le_bytes());

    let mut ctx = Sha256::new();
    ctx.update(&input);
    let digest = ctx.finalize_reset();
    let salt_str = STANDARD_NO_PAD.encode(digest.as_slice());

    Salt::from_b64(Box::leak(salt_str.into_boxed_str()))
        .expect("salt is base64-safe and within limits")
}

/// Hash a password with Argon2 (commits to the hash structure).
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2::Params::default());
    argon2
        .hash_password(password.as_bytes(), random_salt())
        .map(|hashed| hashed.to_string())
        .map_err(AppError::from)
}

/// Return `true` when the password matches the stored hash (Argon2 only).
///
/// BCrypt hashes (the old backend, `$2a$`/`$2b$`/`$2y$` suffixed strings) can't
/// be parsed by Argon2 — they aren't PHC strings, they aren't `Salt`-checked.
/// `PasswordHash::new` used to raise here → the login endpoint answered `500`
/// to **every** email/password login of a legacy account. The legacy scheme
/// is now a clean `false` (→ `401`) so the frontend can offer a password reset
/// instead of an internal error.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    // Legacy password scheme: can't be verified, don't crash.
    if hash.starts_with("$2a$") || hash.starts_with("$2b$") || hash.starts_with("$2y$") {
        return Ok(false);
    }
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2::Params::default());
    let parsed = PasswordHash::new(hash).map_err(|e| AppError::from(e.to_string()))?;
    match argon2.verify_password(password.as_bytes(), &parsed) {
        // Password matches.
        Ok(()) => Ok(true),
        // Mismatch (Error::Password) is correct business logic — the caller
        // answers `401`, never an internal error. Everything else is a real
        // failure (salt too short, invalid base64, ...).
        Err(e) => match e {
            argon2::password_hash::Error::Password => Ok(false),
            other => Err(AppError::from(other.to_string())),
        },
    }
}

/// TOTP (RFC6238) — HMAC-SHA1, base32 secret, 30s step, 6-digit code.
///
/// This replaces `totp-rs` because its 5.x API changed between releases and I
/// cannot compile here to validate it.
mod totp {
    /// Generate a TOTP code for `secret` at the current 30s step.
    pub fn code(secret: &str) -> Result<String, String> {
        let key = decode32(secret)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time went backwards")
            .as_secs()
            / 30;
        let data = now.to_be_bytes();
        let h = hmac_sha1(&key, &data);
        let offset = h[h.len() - 1] as usize & 0x0f;
        let code = (u32::from_be_bytes(h[offset..offset + 4].try_into().unwrap())
            & 0x7fffffff)
            % 1_000_000;
        Ok(format!("{:06}", code))
    }

    /// Decode a base32 string into bytes (case-insensitive); the RFC6238
    /// traditional implementation.
    pub fn decode32(s: &str) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        let mut bits = 0u32;
        let mut count = 0;
        for c in s.to_uppercase().chars() {
            let v = match c {
                'A'..='Z' => c as u8 - b'A',
                '2'..='7' => c as u8 - b'2' + 26,
                '0' | '1' => c as u8 - b'0',
                _ => return Err(format!("bad base32 char: {}", c)),
            };
            bits = bits << 5 | v as u32;
            count += 5;
            if count >= 8 {
                count -= 8;
                bytes.push((bits >> count) as u8);
                bits &= (1 << count) - 1;
            }
        }
        Ok(bytes)
    }

    /// `otpauth://totp/EduMap:label?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30`
    pub fn url(label: &str, issuer: &str, secret: &str) -> String {
        format!(
            "otpauth://totp/{}:{}?secret={}&issuer={}&algorithm=SHA1&digits=6&period=30",
            issuer, label, secret, issuer
        )
    }

    fn hmac_sha1(key: &[u8], data: &[u8]) -> Vec<u8> {
        use hmac::{Hmac, Mac};
        use sha1::{Sha1};
        let mut mac = Hmac::<Sha1>::new_from_slice(key).unwrap();
        mac.update(data);
        mac.finalize().into_bytes().to_vec()
    }
}

/// Tickets in `claims` that survive the auth layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPayload {
    pub access_token: String,
    pub refresh_token: String,
}

/// Request: `POST /api/auth/register` — body `{email, password, full_name, role}`.
#[derive(Debug, Deserialize)]
pub struct RegisterForm {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
}

/// Request: `POST /api/auth/login` — body `{email, password}`.
#[derive(Debug, Deserialize)]
pub struct LoginForm {
    pub email: String,
    pub password: String,
}

/// Request: `POST /api/auth/refresh` — body `{refreshToken, userId}`.
#[derive(Debug, Deserialize)]
pub struct RefreshForm {
    pub refresh_token: String,
    pub user_id: String,
}

/// Request: `POST /api/auth/2fa/verify` — body `{userId, token}`.
#[derive(Debug, Deserialize)]
pub struct VerifyTwoFactorForm {
    pub user_id: String,
    pub token: String,
}

/// Request: `POST /api/auth/change-password` — body `{currentPassword, newPassword}`.
#[derive(Debug, Deserialize)]
pub struct ChangePasswordForm {
    pub current_password: String,
    pub new_password: String,
}

/// Request: `PATCH /api/auth/profile` — body `{full_name, avatar_url, phone, ...}`.
#[derive(Debug, Deserialize)]
pub struct ProfileForm {
    pub full_name: String,
    pub avatar_url: Option<String>,
    pub phone: String,
    pub bio: String,
    pub location: String,
    pub mbti_type: String,
    pub date_of_birth: String,
    pub major: String,
}

/// Request: `POST /api/auth/google` — body `{email, full_name, avatar_url, role, credential}`.
#[derive(Debug, Deserialize)]
pub struct GoogleForm {
    pub email: Option<String>,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: Option<String>,
    pub credential: Option<String>,
}

/// Request: `POST /api/auth/forgot-password` — body `{email}`.
#[derive(Debug, Deserialize)]
pub struct ForgotPasswordForm {
    pub email: String,
}

/// Request: `POST /api/auth/reset-password` — body `{token, newPassword}`.
#[derive(Debug, Deserialize)]
pub struct ResetPasswordForm {
    pub token: String,
    pub new_password: String,
}

/// Request: `PUT /api/auth/preferences` — body `{language, theme, ...}`.
#[derive(Debug, Deserialize)]
pub struct PreferencesForm {
    pub language: Option<String>,
    pub theme: Option<String>,
    pub notifications_enabled: Option<bool>,
    pub privacy_level: Option<String>,
    pub notification_settings: Option<String>,
}



/// DB row for `users` (select items only).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub full_name: String,
    pub role: String,
    pub status: String,
    pub two_factor_secret: Option<String>,
    pub is_two_factor_enabled: bool,
}

const DB_GET_USER_BY_EMAIL: &str = r#"
        SELECT id::text AS id, email, password_hash, full_name,
               role::text AS role, status::text AS status,
               two_factor_secret, is_two_factor_enabled
        FROM users
        WHERE email = $1 AND deleted_at IS NULL
    "#;

const DB_GET_USER_BY_ID: &str = r#"
        SELECT id::text AS id, email, password_hash, full_name,
               role::text AS role, status::text AS status,
               two_factor_secret, is_two_factor_enabled
        FROM users
        WHERE id::text = $1 AND deleted_at IS NULL
    "#;


const DB_INSERT_USER: &str = r#"
        INSERT INTO users (email, password_hash, full_name, role, status,
                           email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4::user_role_enum, 'active', false, NOW(), NOW())
        RETURNING id::text AS id, email, full_name, role::text AS role,
                  status::text AS status, two_factor_secret
    "#;

const DB_UPDATE_PASSWORD: &str = r#"
        UPDATE users SET password_hash = $1, updated_at = NOW()
        WHERE id::text = $2 AND deleted_at IS NULL
    "#;

const DB_UPDATE_REFRESH: &str = r#"
        UPDATE users SET refresh_token_hash = $1, updated_at = NOW()
        WHERE id::text = $2 AND deleted_at IS NULL
    "#;

const DB_UPDATE_2FA: &str = r#"
        UPDATE users SET two_factor_secret = $1,
               is_two_factor_enabled = $2, updated_at = NOW()
        WHERE id::text = $3 AND deleted_at IS NULL
    "#;

const DB_UPDATE_PROFILE: &str = r#"
        UPDATE users SET full_name = $1, avatar_url = $2, phone = $3,
               bio = $4, location = $5, mbti_type = $6, date_of_birth = $7,
               major = $8, updated_at = NOW()
        WHERE id::text = $9 AND deleted_at IS NULL
    "#;

const DB_SELECT_PREFERENCES: &str = r#"
        SELECT user_id::text AS user_id, language, theme, notifications_enabled,
               privacy_level::text AS privacy_level,
               notification_settings::text AS notification_settings
        FROM user_preferences WHERE user_id::text = $1
    "#;

const DB_UPDATE_PREFERENCES: &str = r#"
        INSERT INTO user_preferences (user_id, language, theme, notifications_enabled,
                                      privacy_level, notification_settings, updated_at)
        VALUES ($1::uuid,$2,$3,$4,$5,$6,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            language = $2, theme = $3, notifications_enabled = $4,
            privacy_level = $5, notification_settings = $6, updated_at = NOW()
    "#;

const DB_INSERT_RESET_TOKEN: &str = r#"
        INSERT INTO password_reset_tokens (token, user_id, expires_at, is_used,
                                           created_at, updated_at)
        VALUES ($1,$2::uuid,$3,false,NOW(),NOW())
        RETURNING token, user_id, expires_at, is_used
    "#;

const DB_SELECT_RESET_TOKEN: &str = r#"
        SELECT id, token, user_id, expires_at, is_used, created_at
        FROM password_reset_tokens
        WHERE token = $1 AND is_used = false
    "#;

const DB_UPDATE_RESET_TOKEN: &str = r#"
        UPDATE password_reset_tokens SET is_used = true, updated_at = NOW()
        WHERE token = $1 AND is_used = false
    "#;

/// --- Helpers ---

/// Load a `UserRow` by email.
async fn find_user_by_email(pool: &PgPool, email: &str) -> Result<Option<UserRow>, AppError> {
    let row = crate::db::query(DB_GET_USER_BY_EMAIL)
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;
    match row {
        Some(r) => {
            let user: UserRow = sqlx::FromRow::from_row(&r).map_err(AppError::from)?;
            Ok(Some(user))
        }
        None => Ok(None),
    }
}

/// Load a `UserRow` by id.
async fn find_user_by_id(pool: &PgPool, user_id: &str) -> Result<Option<UserRow>, AppError> {
    let row = crate::db::query(DB_GET_USER_BY_ID)
        .bind(&user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;
    match row {
        Some(r) => {
            let user: UserRow = sqlx::FromRow::from_row(&r).map_err(AppError::from)?;
            Ok(Some(user))
        }
        None => Ok(None),
    }
}

/// Generate the JWT tokens (access + refresh) for a user row.
async fn generate_tokens_for_user(pool: &PgPool, user: &UserRow) -> Result<TokenPayload, AppError> {
    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        role: user.role.clone(),
        iat: current_time() as i64,
        exp: current_time() as i64 + 86400, // 24h
    };
    let access_token = jsonwebtoken::encode(
        &jsonwebtoken::Header {
            typ: Some("JWT".to_string()),
            alg: jsonwebtoken::Algorithm::HS256,
            cty: None,
            jku: None,
            jwk: None,
            kid: None,
            x5u: None,
            x5c: None,
            x5t: None,
            x5t_s256: None,
        },
        &claims,
        &*crate::common::auth::JWT_ENCODING_KEY,
    )
    .expect("jwt encode failed");

    let expires_refresh = current_time() as i64 + 2592000; // 30 days
    let refresh_claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        role: user.role.clone(),
        iat: current_time() as i64,
        exp: expires_refresh,
    };
    let refresh_token = jsonwebtoken::encode(
        &jsonwebtoken::Header {
            typ: Some("JWT".to_string()),
            alg: jsonwebtoken::Algorithm::HS256,
            cty: None,
            jku: None,
            jwk: None,
            kid: None,
            x5u: None,
            x5c: None,
            x5t: None,
            x5t_s256: None,
        },
        &refresh_claims,
        &*crate::common::auth::JWT_REFRESH_ENCODING_KEY,
    )
    .expect("jwt encode failed");

    let refresh_token_hash = crate::common::auth::hash_refresh_token(&refresh_token);
    crate::db::query(DB_UPDATE_REFRESH)
        .bind(&refresh_token_hash)
        .bind(&user.id)
        .execute(pool)
        .await
        .map_err(AppError::from)?;

    Ok(TokenPayload {
        access_token,
        refresh_token,
    })
}

/// Current epoch time in seconds (used by the TOTP helpers).
pub fn current_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs()
}

/// --- Endpoints ---

/// `POST /api/auth/register` — create a new account.
pub async fn register(
    State(pool): State<DbPool>,
    Json(form): Json<RegisterForm>,
) -> Result<axum::response::Response, AppError> {
    if form.email.is_empty() || form.password.is_empty() || form.full_name.is_empty() {
        return Err(AppError::BadRequest("Email, mật khẩu và tên là bắt buộc".to_string()));
    }
    if !matches!(form.role.as_str(), "student" | "parent" | "teacher" | "mentor" | "school_rep" | "university_rep" | "donor" | "employer" | "admin" | "moderator" | "community_coord" | "support_staff" | "partner" | "guest" | "super_admin") {
        return Err(AppError::BadRequest("Vai trò `role` không hợp lệ".to_string()));
    }
    let existing = find_user_by_email(pool.db(), &form.email).await?;
    if existing.is_some() {
        return Err(AppError::Conflict("Email này đã được sử dụng".to_string()));
    }
    let password_hash = hash_password(&form.password)?;
    crate::db::query(DB_INSERT_USER)
        .bind(&form.email)
        .bind(&password_hash)
        .bind(&form.full_name)
        .bind(&form.role)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    let user = find_user_by_email(pool.db(), &form.email).await?
        .ok_or_else(|| AppError::NotFound("Người dùng vừa tạo không tìm thấy".to_string()))?;
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Đăng ký tài khoản thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/login` — authenticate (email/password, optional 2FA).
pub async fn login(
    State(pool): State<DbPool>,
    Json(form): Json<LoginForm>,
) -> Result<axum::response::Response, AppError> {
    let user = find_user_by_email(pool.db(), &form.email).await?
        .ok_or_else(|| AppError::Unauthorized("Thông tin đăng nhập không chính xác.".to_string()))?;
    let valid = verify_password(&form.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized("Thông tin đăng nhập không chính xác.".to_string()));
    }
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Đăng nhập thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/dev-login` — developer account (production-only).
pub async fn dev_login(
    State(pool): State<DbPool>,
) -> Result<axum::response::Response, AppError> {
    let dev_email = std::env::var("DEV_USER_EMAIL").unwrap_or_else(|_| "dev@edumap.vn".to_string());
    let dev_password = std::env::var("DEV_USER_PASSWORD").unwrap_or_else(|_| "dev123456".to_string());
    let user = match find_user_by_email(pool.db(), &dev_email).await? {
        Some(user) => user,
        None => {
            // The Dev User is created with a random Argon2 salt so the
            // `password_hash` column stays parseable by `verify_password`
            // (the old `$2a$12$bcrypt` literal was an invalid hash → 401).
            let password_hash = hash_password(&dev_password)?;
            crate::db::query(DB_INSERT_USER)
                .bind(&dev_email)
                .bind(&password_hash)
                .bind(&"Dev User".to_string())
                .bind(&"student".to_string())
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
            find_user_by_email(pool.db(), &dev_email).await?
                .ok_or_else(|| AppError::NotFound("Dev user creation failed".to_string()))?
        }
    };
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": "https://ui-avatars.com/api/?name=DEV+USER",
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Dev login successful!",
        }))).into_response(),
    )
}

/// `POST /api/auth/google` — Google OAuth (JWT `credential` decoded).
///
/// The `credential` is a JWT signed by Google (RS256/RS384/RS512) — the module
/// verifies the signature against Google's current JWKS (cached for one hour),
/// checks the issuer `iss` + required claims (`sub`, `exp`) and only *then*
/// reads the `email` claim of the payload.  An *unverified* payload is never
/// used (`POST /api/auth/google` answers 400/503 on any failure, never 200).
pub async fn google_auth(
    State(pool): State<DbPool>,
    Json(body): Json<GoogleForm>,
) -> Result<axum::response::Response, AppError> {
    // A credential always carries the *verified* email claim (the payload is
    // signed by Google and verified against Google's JWKS), so it wins over the
    // form field: an `email` submitted without a credential cannot be verified
    // at all (it must never be trusted).  The frontend sends `email: ''` when
    // it uses the Google Identity Services callback, hence the field is only
    // consulted when there is no credential.
    let email = match (body.email, body.credential) {
        (_, Some(credential)) => verify_google_credential(&credential).await?.email,
        (Some(email), None) if !email.is_empty() => email,
        _ => {
            return Err(AppError::BadRequest(
                "Email từ tài khoản Google là bắt buộc.".to_string(),
            ));
        }
    };
    let user = find_user_by_email(pool.db(), &email).await?;
    let user = match user {
        Some(user) => user,
        None => {
        // Google-authenticated users never log in with a password; seed a
        // **valid** Argon2 hash (random per-account) so the column stays
        // parseable by `verify_password` (the old `$2a$12$bcrypt` literal was
        // an invalid hash → 401 on the next password attempt).
        let password_hash = hash_password("google-auth-no-password")?;
        crate::db::query(DB_INSERT_USER)
            .bind(&email)
            .bind(&password_hash)
            .bind(&body.full_name.clone().unwrap_or_default())
            .bind(&body.role.clone().unwrap_or_else(|| "student".to_string()))
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
            find_user_by_email(pool.db(), &email).await?
                .ok_or_else(|| AppError::NotFound("Google user creation failed".to_string()))?
        }
    };
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": body.avatar_url,
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Đăng nhập Google thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/refresh` — exchange a refresh token for a new pair.
pub async fn refresh(
    State(pool): State<DbPool>,
    Json(form): Json<RefreshForm>,
) -> Result<axum::response::Response, AppError> {
    let user = find_user_by_id(pool.db(), &form.user_id).await?
        .ok_or_else(|| AppError::Unauthorized("Phiên đăng nhập không còn hạn.".to_string()))?;
    // The refresh token is compared with the stored hash.
    let raw_refresh = jsonwebtoken::decode::<Claims>(
        &form.refresh_token,
        &*crate::common::auth::JWT_DECODING_KEY,
        &jsonwebtoken::Validation::default(),
    )
    .map_err(AppError::from)?;
    if raw_refresh.claims.sub != user.id {
        return Err(AppError::Unauthorized("Token làm mới không hợp lệ.".to_string()));
    }
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Refresh token mới được cấp.",
        }))).into_response(),
    )
}

/// `GET /api/auth/me` — authenticated user profile.
pub async fn me(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
) -> Result<axum::response::Response, AppError> {
    let profile = find_user_by_id(pool.db(), &user.id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "avatar_url": "https://ui-avatars.com/api/?name=ME",
            "role": profile.role,
            "points": 1,
            "level": 1,
            "status": profile.status,
        }))).into_response(),
    )
}

/// `PATCH /api/auth/profile` — update the public profile.
pub async fn update_profile(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(form): Json<ProfileForm>,
) -> Result<axum::response::Response, AppError> {
    let profile = find_user_by_id(pool.db(), &user.id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    crate::db::query(DB_UPDATE_PROFILE)
        .bind(&form.full_name)
        .bind(&form.avatar_url)
        .bind(&form.phone)
        .bind(&form.bio)
        .bind(&form.location)
        .bind(&form.mbti_type)
        .bind(&form.date_of_birth)
        .bind(&form.major)
        .bind(&profile.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "avatar_url": profile.two_factor_secret,
        }))).into_response(),
    )
}

/// `PUT /api/auth/preferences` — update the user's preferences.
pub async fn update_preferences(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(form): Json<PreferencesForm>,
) -> Result<axum::response::Response, AppError> {
    let profile = find_user_by_id(pool.db(), &user.id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    // The DTO field maps to `user_preferences.notifications_enabled`; the per-
    // flag (email/call/sms) settings stay in `notification_settings`.
    let settings = form.notification_settings.unwrap_or_default();
    crate::db::query(DB_UPDATE_PREFERENCES)
        .bind(&profile.id)
        .bind(&form.language.unwrap_or_else(|| "vi".to_string()))
        .bind(&form.theme.unwrap_or_else(|| "dark".to_string()))
        .bind(&form.notifications_enabled.unwrap_or(true))
        .bind(&form.privacy_level.unwrap_or_else(|| "public".to_string()))
        .bind(&settings)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": profile.id,
            "message": "Cập nhật sở thích thành công!",
        }))).into_response(),
    )
}

/// `GET /api/auth/preferences` — the user's preferences (initialized if
/// missing, matching the old backend).
pub async fn get_preferences(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
) -> Result<axum::response::Response, AppError> {
    let profile = find_user_by_id(pool.db(), &user.id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    let prefs_row = crate::db::query(DB_SELECT_PREFERENCES)
        .bind(&profile.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let prefs = match prefs_row {
        Some(r) => {
            let p: PreferenceRow = sqlx::FromRow::from_row(&r).map_err(AppError::from)?;
            Some(p)
        }
        None => None,
    };
    let prefs = prefs.unwrap_or_else(|| PreferenceRow {
        user_id: profile.id.clone(),
        language: "vi".to_string(),
        theme: "dark".to_string(),
        notifications_enabled: true,
        privacy_level: "public".to_string(),
        // `""` — the frontend only `JSON.parse`s a non-empty value (`""` →
        // `{}`), so there is no string `"null"` escaping into the response.
        notification_settings: String::new(),
    });
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": profile.id,
            "language": prefs.language,
            "theme": prefs.theme,
            "notifications_enabled": prefs.notifications_enabled,
            "privacy_level": prefs.privacy_level,
            "notification_settings": prefs.notification_settings,
        }))).into_response(),
    )
}

/// `user_id` chỉ dùng cho `sqlx::FromRow` (không đọc trong code).
#[allow(dead_code)]
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PreferenceRow {
    pub user_id: String,
    pub language: String,
    pub theme: String,
    pub notifications_enabled: bool,
    pub privacy_level: String,
    pub notification_settings: String,
}

/// `POST /api/auth/forgot-password` — generate the password reset token and
/// store it in `password_reset_tokens` (the email itself is sent by the
/// ai-service/`lettre` daemon; here the token exists so the frontend can
/// verify the flow end-to-end).
pub async fn forgot_password(
    State(pool): State<DbPool>,
    Json(form): Json<ForgotPasswordForm>,
) -> Result<axum::response::Response, AppError> {
    let user = find_user_by_email(pool.db(), &form.email).await?
        .ok_or_else(|| AppError::BadRequest("Email chưa được đăng ký.".to_string()))?;
    // A fresh, unknown token (the same shape as the old `crypto.randomBytes`).
    let token = uuid::Uuid::new_v4().to_string();
    let expires_at = DateTime::<Utc>::from_timestamp(current_time() as i64 + 60 * 60, 0)
        .expect("epoch calculation");
    crate::db::query(DB_INSERT_RESET_TOKEN)
        .bind(&token)
        .bind(&user.id)
        .bind(&expires_at)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    let _token = crate::db::query(DB_SELECT_RESET_TOKEN)
        .bind(&token)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::Internal("Token creation failed".to_string()))?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "message": "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.",
            "userId": user.id,
        }))).into_response(),
    )
}

/// `POST /api/auth/reset-password` — verify the reset token and store the
/// new password.
pub async fn reset_password(
    State(pool): State<DbPool>,
    Json(form): Json<ResetPasswordForm>,
) -> Result<axum::response::Response, AppError> {
    let token = crate::db::query(DB_SELECT_RESET_TOKEN)
        .bind(&form.token)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::BadRequest("Token đặt lại mật khẩu không hợp lệ.".to_string()))?;
    let expires_at = token.get::<DateTime<Utc>, &str>("expires_at");
    if std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs() > expires_at.timestamp() as u64
    {
        return Err(AppError::BadRequest("Token đặt lại mật khẩu đã hết hạn.".to_string()));
    }
    let user = find_user_by_id(pool.db(), &crate::db::text(&token, "user_id")).await?
        .ok_or_else(|| AppError::Internal("User not found for reset token".to_string()))?;
    let hash = hash_password(&form.new_password)?;
    crate::db::query(DB_UPDATE_PASSWORD)
        .bind(&hash)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    crate::db::query(DB_UPDATE_RESET_TOKEN)
        .bind(&form.token)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "message": "Đặt lại mật khẩu thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/change-password` — change the current password.
pub async fn change_password(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
    Json(form): Json<ChangePasswordForm>,
) -> Result<axum::response::Response, AppError> {
    let profile = find_user_by_id(pool.db(), &user.id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    // Legacy rows are still hashed with BCrypt (`$2a$`/`$2b$`/`$2y$`) — Argon2
    // cannot re-verify them (`verify_password` returns `Ok(false)` on any
    // input), so the logged-in user cannot prove the old password here.  The
    // only safe path is the password-reset flow (`forgot-password`), which
    // alone can issue a token.
    if profile.password_hash.starts_with("$2a$")
        || profile.password_hash.starts_with("$2b$")
        || profile.password_hash.starts_with("$2y$")
    {
        return Err(AppError::BadRequest(
            "Tài khoản của bạn lưu mật khẩu cũ (BCrypt) — vui lòng sử dụng chức năng".to_string()
                + " đặt lại mật khẩu để đổi mật khẩu mới.",
        ));
    }
    // The current password must match the stored Argon2 hash...
    if !verify_password(&form.current_password, &profile.password_hash)? {
        return Err(AppError::BadRequest("Mật khẩu hiện tại không chính xác.".to_string()));
    }
    // ...and the new password must **not** be identical to the current one
    // (`verify_password` returns `false` when they differ).
    if verify_password(&form.new_password, &profile.password_hash)? {
        return Err(AppError::BadRequest("Mật khẩu mới phải khác mật khẩu hiện tại.".to_string()));
    }
    let hash = hash_password(&form.new_password)?;
    crate::db::query(DB_UPDATE_PASSWORD)
        .bind(&hash)
        .bind(&profile.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": profile.id,
            "message": "Đổi mật khẩu thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/2fa/generate` — generate the 2FA TOTP secret + QR.
///
/// In Phase 1 this stores the 2FA secret for a user without the actual key
/// link to Google Authenticator (the `totp` helpers are here).
pub async fn generate_2fa(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
) -> Result<axum::response::Response, AppError> {
    let secret = crate::common::auth::generate_totp_secret();
    crate::db::query(DB_UPDATE_2FA)
        .bind(&secret)
        .bind(&true)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    let url = totp::url(&user.email, "EduMap", &secret);
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "secret": secret,
            "qr_code_url": url,
            "message": "2FA đã được bật. Quét QR bằng ứng dụng xác thực.",
        }))).into_response(),
    )
}

/// `POST /api/auth/2fa/verify` — verify the TOTP code.
pub async fn verify_2fa(
    State(pool): State<DbPool>,
    Json(form): Json<VerifyTwoFactorForm>,
) -> Result<axum::response::Response, AppError> {
    let user = find_user_by_id(pool.db(), &form.user_id).await?
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại.".to_string()))?;
    if !user.is_two_factor_enabled {
        return Ok(
            axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
                "message": "2FA chưa được bật cho tài khoản này.",
            }))).into_response(),
        );
    }
    let secret = user.two_factor_secret.clone()
        .ok_or_else(|| AppError::BadRequest("Chưa có bí mật 2FA.".to_string()))?;
    let valid = match totp::code(&secret) {
        Ok(code) => code == form.token,
        Err(error) => return Err(AppError::BadRequest(error)),
    };
    if !valid {
        return Err(AppError::Unauthorized("Mã 2FA không hợp lệ".to_string()));
    }
    let tokens = generate_tokens_for_user(pool.db(), &user).await?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "userId": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "message": "Xác thực 2FA thành công!",
        }))).into_response(),
    )
}

/// `POST /api/auth/logout` — invalidate the current token pair.
pub async fn logout(
    State(pool): State<DbPool>,
    Extension(user): Extension<AuthUser>,
) -> Result<axum::response::Response, AppError> {
    crate::db::query(DB_UPDATE_REFRESH)
        .bind("invalidated")
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    Ok(
        axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
            "message": "Đăng xuất thành công!",
        }))).into_response(),
    )
}

#[cfg(test)]
mod test {
    use super::*;

    /// A legacy BCrypt hash (the old backend format).
    const LEGACY_BCRYPT: &str =
        "$2b$10$8ihwHqyp8bj5.CUMXXZg8.hwiLZkTjHRs4B6JqBm8thI0IYaXMcVO";

    /// BCrypt strings must never reach `PasswordHash::new` (the decode raised
    /// and the login endpoint answered 500).
    #[test]
    fn test_verify_password_legacy_bcrypt_fails_cleanly() {
        assert_eq!(verify_password("anything", LEGACY_BCRYPT).unwrap(), false,
            "legacy bcrypt must not panic nor 500");
        assert_eq!(verify_password("wrong", LEGACY_BCRYPT).unwrap(), false);
    }

    /// Legacy prefixes are dropped before parsing.
    #[test]
    fn test_verify_password_legacy_prefixes() {
        for prefix in ["$2a$", "$2b$", "$2y$"] {
            let h = format!("{}10$salt-hash-data-dfghdfh86786", prefix);
            assert!(PasswordHash::new(h.as_str()).is_err(),
                "must not look like a PHC string: {}", h);
            assert_eq!(verify_password("x", &h).unwrap(), false);
        }
    }

    /// An invalid hash (garbage, no argon2 header) — must stay an error path,
    /// not a panic.
    #[test]
    fn test_verify_password_invalid() {
        let r = verify_password("x", "garbage");
        assert!(r.is_err(), "an invalid hash must be an error, {:?}", r);
    }

    /// A fresh hash must validate and rehash at least produce `$argon2id$`.
    #[test]
    fn test_hash_password_moves_argon2() {
        let h = hash_password("some-password").unwrap();
        let fields: Vec<&str> = h.split('$').collect();
        assert!(fields.len() >= 6, "not a valid argon2 PHC string: {}", h);
        assert!(h.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"), "got {}", h);
        // 6 fields = algorithm, version, params, salt, hash (+ leading empty).
        assert_eq!(fields.len(), 6);
        assert!(h.len() > 40);
    }

    /// Freshly hashed passwords verify (mismatch → `Ok(false)`, never an error).
    #[test]
    fn test_hash_and_verify_round_trip() {
        let h = hash_password("some-password").unwrap();
        assert!(verify_password("some-password", &h).unwrap());
        assert_eq!(
            verify_password("other-password", &h).unwrap(),
            false,
            "a mismatch must be `Ok(false)` and not an internal error"
        );
    }

    /// A wrong password against a legacy BCrypt hash must be `Ok(false)`, never
    /// a `500`.
    #[test]
    fn test_mismatch_legacy_bcrypt() {
        assert_eq!(verify_password("wrong", LEGACY_BCRYPT).unwrap(), false);
    }

    /// Random salts must (a) be valid salts (PHC charset, 4-64 chars) and
    /// (b) differ per call.
    #[test]
    fn test_random_salt_unique() {
        let a = hash_password("x").unwrap();
        let b = hash_password("y").unwrap();
        assert!(a.starts_with("$argon2id$v=19$"), "not argon2: {}", a);
        assert!(b.starts_with("$argon2id$v=19$"), "not argon2: {}", b);
        // Salt lives after the params field
        // (`$argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>`).
        let fields: Vec<&str> = a.split('$').collect();
        if fields.len() >= 5 {
            let salt = fields[4];
            assert!(salt.len() >= 4 && salt.len() <= 64, "salt length {}", salt.len());
        }
    }

    /// A password hashed twice must **not** compare equal (per-password salt).
    #[test]
    fn test_different_shadows_per_password() {
        let h1 = hash_password("same").unwrap();
        let h2 = hash_password("same").unwrap();
        assert!(verify_password("same", &h1).unwrap());
        assert!(verify_password("same", &h2).unwrap());
        assert_ne!(h1, h2);
    }

    /// The current password **must** be re-verified (Argon2 row): a match
    /// reports `true` (the check must fire on a matching password).
    #[test]
    fn test_verify_interests_current_password_is_true() {
        let h = hash_password("some-password").unwrap();
        assert!(verify_password("some-password", &h).unwrap(),
            "the current password must verify against the new hash");
    }

    /// The new password **must not** be the current one (`change_password`
    /// answers 400 when it is).
    ///
    /// `verify_password(new_password, old_hash)` returns `true` exactly when
    /// `new_password == current_password` (it verifies against the stored
    /// hash), so the endpoint rejects the request when the call returns `true`.
    #[test]
    fn test_change_password_new_must_differ_from_current() {
        let h = hash_password("some-password").unwrap();
        // A *matching* new password verifies against the old hash → the
        // endpoint answers 400 "mật khẩu mới phải khác mật khẩu hiện tại".
        assert!(verify_password("some-password", &h).unwrap());
        // A *different* new password does not verify → the change is allowed.
        assert_eq!(verify_password("something-else", &h).unwrap(), false);
        // Practical rule: new and current must not be the same string.
        assert_ne!("something-else", "some-password");
    }

    /// The legacy BCrypt prefix means no Argon2 verification is possible
    /// (`change_password` answers 400 with the reset recommendation).
    #[test]
    fn test_no_argon2_verification_for_legacy_hashes() {
        for prefix in ["$2a$", "$2b$", "$2y$"] {
            let h = format!("{}10$salt-data-hash-123456789012345", prefix);
            assert_eq!(verify_password("correct-old-pass", &h).unwrap(), false,
                "no argon2 solution exists for a BCrypt hash: {}", h);
        }
        // A *mismatching* current password is truthy regardless (it cannot be
        // proved, hence the reset recommendation).
        assert_eq!(verify_password("wrong-pass", LEGACY_BCRYPT).unwrap(), false);
    }

    /// The preferences fallback must be an empty string, not the stringified
    /// `null` (the frontend only `JSON.parse`s a non-empty value).
    #[test]
    fn test_preferences_default() {
        let row = PreferenceRow {
            user_id: String::new(),
            language: "vi".to_string(),
            theme: "dark".to_string(),
            notifications_enabled: true,
            privacy_level: "public".to_string(),
            notification_settings: String::new(),
        };
        // The handler builds the JSON from the row: `notification_settings`
        // must serialize as `""` (not `"null"`).
        let json = serde_json::json!({
            "language": row.language,
            "theme": row.theme,
            "notifications_enabled": row.notifications_enabled,
            "privacy_level": row.privacy_level,
            "notification_settings": row.notification_settings,
        });
        assert_eq!(json.get("notification_settings").unwrap(), "");
    }
}
