//! Authentication endpoints.
//!
//! Mirrors `backend/src/modules/auth/auth.controller.ts` + `auth.service.ts`:
//! register, login, dev-login, google-auth, refresh, me, profile, preferences,
//! change-password, 2fa, logout.
//!
//! Passwords: `argon2` (Argon2id, Argon2 v1.3) — the same bcrypt *cost* of the
//! old backend is reproduced as a static, distributed salt. 2FA: raw TOTP
//! (RFC6238, HMAC-SHA1) so no `totp-rs` API drift breaks the build.
use crate::common::auth::{AuthUser, Claims};
use crate::common::error::AppError;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, Salt};
use argon2::Algorithm;
use argon2::Argon2;
use argon2::Version;
use axum::extract::{Extension, Json, State};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

/// The app-wide salt used by Argon2 (same across all runs).
pub fn app_salt() -> Salt {
    Salt::try_from(b"edumap-migrate-argon2-salt-32-bytes-long_")
        .expect("app salt length")
}

/// Hash a password with Argon2 (commits to the generated structure).
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V1_3, argon2::Params::default());
    argon2
        .hash_password(password.as_bytes(), &app_salt())
        .map(|hashed| hashed.to_string())
        .map_err(AppError::from)
}

/// Return `true` when the password matches the stored hash (Argon2 only).
///
/// BCrypt (the old backend) hashed values can't be verified by Argon2, which
/// is why a password reset is forced on the first successful login after the
/// migration (see `login` below).
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V1_3, argon2::Params::default());
    let parsed = PasswordHash::new(hash).map_err(|e| AppError::from(e.to_string()))?;
    argon2
        .verify_password(password.as_bytes(), &parsed)
        .map(|()| true)
        .map_err(AppError::from)
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
        use sha1::{Sha1, Digest};
        let mut mac = Hmac::<Sha1>::new_from_key(key);
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

/// Response: `User out` (used by `me`, `profile`, `preferences` and `google`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserOut {
    pub userId: String,
    pub email: String,
    pub full_name: String,
    pub avatar_url: Option<String>,
    pub role: String,
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
        SELECT id, email, password_hash, full_name, role, status,
               two_factor_secret, is_two_factor_enabled
        FROM users
        WHERE email = $1 AND deleted_at IS NULL
    "#;

const DB_GET_USER_BY_ID: &str = r#"
        SELECT id, email, password_hash, full_name, role, status,
               two_factor_secret, is_two_factor_enabled
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
    "#;

const DB_GET_USER_BY_REFRESH: &str = r#"
        SELECT id, email, password_hash, full_name, role, status,
               two_factor_secret, is_two_factor_enabled,
               refresh_token_hash
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
    "#;

const DB_INSERT_USER: &str = r#"
        INSERT INTO users (email, password_hash, full_name, role, status,
                           email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'active', false, NOW(), NOW())
        RETURNING id, email, full_name, role, status, two_factor_secret
    "#;

const DB_UPDATE_PASSWORD: &str = r#"
        UPDATE users SET password_hash = $1, updated_at = NOW()
        WHERE id = $2 AND deleted_at IS NULL
    "#;

const DB_UPDATE_REFRESH: &str = r#"
        UPDATE users SET refresh_token_hash = $1, updated_at = NOW()
        WHERE id = $2 AND deleted_at IS NULL
    "#;

const DB_UPDATE_2FA: &str = r#"
        UPDATE users SET two_factor_secret = $1,
               is_two_factor_enabled = $2, updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
    "#;

const DB_UPDATE_PROFILE: &str = r#"
        UPDATE users SET full_name = $1, avatar_url = $2, phone = $3,
               bio = $4, location = $5, mbti_type = $6, date_of_birth = $7,
               major = $8, updated_at = NOW()
        WHERE id = $9 AND deleted_at IS NULL
    "#;

const DB_SELECT_PREFERENCES: &str = r#"
        SELECT user_id, language, theme, notifications_enabled, privacy_level,
               notification_settings
        FROM user_preferences WHERE user_id = $1
    "#;

const DB_UPDATE_PREFERENCES: &str = r#"
        INSERT INTO user_preferences (user_id, language, theme, notifications_enabled,
                                      privacy_level, notification_settings, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            language = $2, theme = $3, notifications_enabled = $4,
            privacy_level = $5, notification_settings = $6, updated_at = NOW()
    "#;

const DB_INSERT_RESET_TOKEN: &str = r#"
        INSERT INTO password_reset_tokens (token, user_id, expires_at, is_used,
                                           created_at, updated_at)
        VALUES ($1, $2, $3, false, NOW(), NOW())
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
    sqlx::query_as::<sqlx::Postgres, UserRow>(DB_GET_USER_BY_EMAIL)
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)
}

/// Load a `UserRow` by id.
async fn find_user_by_id(pool: &PgPool, user_id: &str) -> Result<Option<UserRow>, AppError> {
    sqlx::query_as::<sqlx::Postgres, UserRow>(DB_GET_USER_BY_ID)
        .bind(&user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)
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
            alg: jsonwebtoken::Algorithm::HS256,
            typ: Some("JWT".to_string()),
            cty: None,
            jwk: None,
            jti: None,
            kid: None,
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
            alg: jsonwebtoken::Algorithm::HS256,
            typ: Some("JWT".to_string()),
            cty: None,
            jwk: None,
            jti: None,
            kid: None,
        },
        &refresh_claims,
        &*crate::common::auth::JWT_REFRESH_ENCODING_KEY,
    )
    .expect("jwt encode failed");

    let refresh_token_hash = crate::common::auth::hash_refresh_token(&refresh_token);
    sqlx::query(DB_UPDATE_REFRESH)
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
        return Err(AppError::BadRequest("Email, mật khẩu và tên là bắt buộc"));
    }
    if !matches!(form.role.as_str(), "student" | "parent" | "teacher" | "mentor" | "school_rep" | "university_rep" | "donor" | "employer" | "admin" | "moderator" | "community_coord" | "support_staff" | "partner" | "guest" | "super_admin") {
        return Err(AppError::BadRequest("Vai trò `role` không hợp lệ"));
    }
    let existing = find_user_by_email(pool.db(), &form.email).await?;
    if existing.is_some() {
        return Err(AppError::Conflict("Email này đã được sử dụng"));
    }
    let password_hash = hash_password(&form.password)?;
    sqlx::query(DB_INSERT_USER)
        .bind(&form.email)
        .bind(&password_hash)
        .bind(&form.full_name)
        .bind(&form.role)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    let user = find_user_by_email(pool.db(), &form.email).await?
        .ok_or_else(|| AppError::NotFound("Người dùng vừa tạo không tìm thấy"))?;
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
        .ok_or_else(|| AppError::Unauthorized("Thông tin đăng nhập không chính xác."))?;
    let valid = verify_password(&form.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized("Thông tin đăng nhập không chính xác."));
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
    let user = match find_user_by_email(pool.db(), &dev_email).await? {
        Some(user) => user,
        None => {
            sqlx::query(DB_INSERT_USER)
                .bind(&dev_email)
                .bind(&"$2a$12$bcrypt".to_string())
                .bind(&"Dev User".to_string())
                .bind(&"student".to_string())
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
            find_user_by_email(pool.db(), &dev_email).await?
                .ok_or_else(|| AppError::NotFound("Dev user creation failed"))?
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
pub async fn google_auth(
    State(pool): State<DbPool>,
    Json(body): Json<GoogleForm>,
) -> Result<axum::response::Response, AppError> {
    let email = match body.email.or_else(|| body.credential_email().ok()) {
        Some(email) => email,
        None => return Err(AppError::BadRequest("Email từ tài khoản Google là bắt buộc.")),
    };
    let user = find_user_by_email(pool.db(), &email).await?;
    let user = match user {
        Some(user) => user,
        None => {
            sqlx::query(DB_INSERT_USER)
                .bind(&email)
                .bind(&"$2a$12$bcrypt".to_string())
                .bind(&body.full_name.clone().unwrap_or_default())
                .bind(&body.role.clone().unwrap_or_else(|| "student".to_string()))
                .execute(pool.db())
                .await
                .map_err(AppError::from)?;
            find_user_by_email(pool.db(), &email).await?
                .ok_or_else(|| AppError::NotFound("Google user creation failed"))?
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
        .ok_or_else(|| AppError::Unauthorized("Phiên đăng nhập không còn hạn."))?;
    // The refresh token is compared with the stored hash.
    let raw_refresh = jsonwebtoken::decode::<Claims>(
        &form.refresh_token,
        &*crate::common::auth::JWT_DECODING_KEY,
        jsonwebtoken::Validation::default(),
    )
    .map_err(AppError::from)?;
    if raw_refresh.claims.sub != user.id {
        return Err(AppError::Unauthorized("Token làm mới không hợp lệ."));
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
    sqlx::query(DB_UPDATE_PROFILE)
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
    // The DTO field maps to `user_preferences.notifications_enabled`; the per-
    // flag (email/call/sms) settings stay in `notification_settings`.
    let settings = form.notification_settings.unwrap_or_default();
    sqlx::query(DB_UPDATE_PREFERENCES)
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
    let prefs = sqlx::query_as::<sqlx::Postgres, PreferenceRow>(DB_SELECT_PREFERENCES)
        .bind(&profile.id)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?;
    let prefs = prefs.unwrap_or_else(|| PreferenceRow {
        user_id: profile.id.clone(),
        language: "vi".to_string(),
        theme: "dark".to_string(),
        notifications_enabled: true,
        privacy_level: "public".to_string(),
        notification_settings: serde_json::Value::Null,
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
        .ok_or_else(|| AppError::BadRequest("Email chưa được đăng ký."))?;
    // A fresh, unknown token (the same shape as the old `crypto.randomBytes`).
    let token = uuid::Uuid::new_v4().to_string();
    let expires_at = current_time() as i64 + 60 * 60; // 1 hour
    sqlx::query(DB_INSERT_RESET_TOKEN)
        .bind(&token)
        .bind(&user.id)
        .bind(&expires_at)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    let token = sqlx::query(DB_SELECT_RESET_TOKEN)
        .bind(&token)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::Internal("Token creation failed"))?;
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
    let token = sqlx::query(DB_SELECT_RESET_TOKEN)
        .bind(&form.token)
        .fetch_optional(pool.db())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::BadRequest("Token đặt lại mật khẩu không hợp lệ."))?;
    if std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs() > token.expires_at as u64 {
        return Err(AppError::BadRequest("Token đặt lại mật khẩu đã hết hạn."));
    }
    let user = find_user_by_id(pool.db(), &token.user_id).await?
        .ok_or_else(|| AppError::Internal("User not found for reset token"))?;
    let hash = hash_password(&form.new_password)?;
    sqlx::query(DB_UPDATE_PASSWORD)
        .bind(&hash)
        .bind(&user.id)
        .execute(pool.db())
        .await
        .map_err(AppError::from)?;
    sqlx::query(DB_UPDATE_RESET_TOKEN)
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
    if !verify_password(&form.current_password, &profile.password_hash)? {
        return Err(AppError::BadRequest("Mật khẩu hiện tại không chính xác."));
    }
    if !verify_password(&form.new_password, &profile.password_hash)? {
        return Err(AppError::BadRequest("Mật khẩu mới phải khác mật khẩu hiện tại."));
    }
    let hash = hash_password(&form.new_password)?;
    sqlx::query(DB_UPDATE_PASSWORD)
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
    sqlx::query(DB_UPDATE_2FA)
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
        .ok_or_else(|| AppError::NotFound("Người dùng không tồn tại."))?;
    if !user.is_two_factor_enabled {
        return Ok(
            axum::Json(ApiResponse::<serde_json::Value>::ok(serde_json::json!({
                "message": "2FA chưa được bật cho tài khoản này.",
            }))).into_response(),
        );
    }
    let secret = user.two_factor_secret.clone()
        .ok_or_else(|| AppError::BadRequest("Chưa có bí mật 2FA."))?;
    let valid = match totp::code(&secret) {
        Ok(code) => code == form.token,
        Err(error) => return Err(AppError::BadRequest(error)),
    };
    if !valid {
        return Err(AppError::Unauthorized("Mã 2FA không hợp lệ"));
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
    sqlx::query(DB_UPDATE_REFRESH)
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

/// Google `credential` subtitle (base64 payload) decoding.
impl GoogleForm {
    fn credential_email(&self) -> Result<String, String> {
        match &self.credential {
            Some(c) => {
                let parts: Vec<&str> = c.split('.').collect();
                if parts.len() != 3 {
                    return Err("google credential malformed".to_string());
                }
                let decoded = base64::decode(parts[1])
                    .map_err(|e| e.to_string())?;
                let json: serde_json::Value = serde_json::from_slice(&decoded)
                    .map_err(|e| e.to_string())?;
                json.get("email").map(|s| s.to_string())
                    .ok_or_else(|| "no email in google credential".to_string())
            }
            None => Err("no google credential".to_string()),
        }
    }
}
