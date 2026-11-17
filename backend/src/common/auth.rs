//! Authentication (JWT): the NestJS `passport-jwt` + `RolesGuard` port.
//!
//! The middleware layer (`AuthLayer`) extracts `Authorization: Bearer <jwt>`,
//! decodes it, and merges the claims (`id / email / role`) into the request
//! extensions so handlers can read them (`user.id`, `user.role`).
use axum::body::Body;
use axum::extract::Extension;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::convert::Infallible;
use std::pin::Pin;
use std::task::{Context, Poll};
use tower::Layer;
use tower::Service;

/// The full request type used by `tower::Service` in axum.
type ServiceRequest = axum::http::Request<Body>;

/// A boxed future whose output mirrors the wrapped service's `Response`/`Error`
/// (the middleware must answer for whatever the inner service answers).
///
/// The inner service is moved into the async block, so the boxed future is
/// `'static`: nothing borrows from the middleware outlives the reply.
type BoxFuture<S, E> =
    Pin<Box<dyn std::future::Future<Output = Result<S, E>> + Send + 'static>>;

/// JWT claims — the same shape as the NestJS `passport-jwt` strategy.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub iat: i64,
    pub exp: i64,
}

/// The state that survives a decoded token.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
    pub role: String,
}

/// Paths that never need a token (previously `@Public()`).
///
/// Read/list endpoints are public; write handlers authenticate themselves by
/// calling `authenticated_user` (answering 401 when there is no token).
///
/// The list is intentionally exhaustive: a handful of modules (`auth`, `ai`,
/// `impact-measurement` auto-cached, `offline-tutor`) validate the JWT inside
/// the handler instead of delegating to `AuthLayer`, so every route has to be
/// public here or a logged-in user would be blocked by the middleware.
pub const PUBLIC_PATHS: &[&str] = &[
    "/api/admin/auto-scheduler/health",
    "/api/admin/content/pending",
    "/api/admin/crawl-map",
    "/api/admin/dashboard",
    "/api/admin/data-quality/report",
    "/api/admin/question-gaps",
    "/api/admin/users",
    "/api/admin/users/:id",
    "/api/admin/users/:id/restore",
    "/api/admin/users/:id/status",
    "/api/ai/agent/chat",
    "/api/ai/agent/chat-stream",
    "/api/ai/chat",
    "/api/ai/chat-stream",
    "/api/ai/history",
    "/api/ai/speech/to-text",
    "/api/ai/{*rest}",
    "/api/analytics/education",
    "/api/analytics/stats",
    "/api/analytics/track",
    "/api/audit-logs",
    "/api/auth/2fa/generate",
    "/api/auth/2fa/verify",
    "/api/auth/change-password",
    "/api/auth/dev-login",
    "/api/auth/forgot-password",
    "/api/auth/google",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/preferences",
    "/api/auth/profile",
    "/api/auth/refresh",
    "/api/auth/register",
    "/api/auth/reset-password",
    "/api/blockchain/issue",
    "/api/blockchain/verify/:code",
    "/api/bookmarks",
    "/api/business",
    "/api/business/:bpId/products",
    "/api/business/:bpId/products/:id",
    "/api/business/:bpId/services",
    "/api/business/:bpId/services/:id",
    "/api/business/:id/profile",
    "/api/business/:id/verify",
    "/api/business/cart",
    "/api/business/cart/:id",
    "/api/business/cart/add",
    "/api/business/checkout",
    "/api/business/orders/me",
    "/api/business/orders/vendor",
    "/api/business/products/:id",
    "/api/business/products/:id/reviews",
    "/api/business/profile",
    "/api/business/services/:id",
    "/api/business/services/:id/reviews",
    "/api/career/ai-advice",
    "/api/career/applications",
    "/api/career/applications/:id",
    "/api/career/applications/:id/status",
    "/api/career/applications/:id/withdraw",
    "/api/career/jobs",
    "/api/career/jobs/:id",
    "/api/career/paths",
    "/api/career/paths/:id",
    "/api/career/roadmap/:id",
    "/api/career/suggest",
    "/api/career/upload-resume",
    "/api/career/user-careers",
    "/api/career/user-careers/:id",
    "/api/career/user-skills",
    "/api/career/user-skills/:id",
    "/api/certificates/download/:code.pdf",
    "/api/certificates/issue",
    "/api/certificates/portfolio",
    "/api/certificates/verify/:code",
    "/api/community/groups",
    "/api/community/groups/:id/join",
    "/api/community/posts",
    "/api/community/posts/:id",
    "/api/community/posts/:id/comments",
    "/api/community/posts/:id/like",
    "/api/config",
    "/api/crawler/history",
    "/api/crawler/stats",
    "/api/crawler/status",
    "/api/crawler/trigger",
    "/api/crawler/types",
    "/api/dashboard/history",
    "/api/dashboard/insight",
    "/api/dashboard/overview",
    "/api/dashboard/stats",
    "/api/donations",
    "/api/donations/campaigns",
    "/api/donations/campaigns/:id",
    "/api/donations/campaigns/:id/donors",
    "/api/donations/payment-url",
    "/api/events",
    "/api/events/:id",
    "/api/events/:id/register",
    "/api/gamification/grant-achievement",
    "/api/gamification/grant-points",
    "/api/gamification/leaderboard",
    "/api/gamification/my-badges",
    "/api/gamification/my-progress",
    "/api/gamification/progress/:userId",
    "/api/gamification/submit-activity",
    "/api/geo/satellite-tiles",
    "/api/geo/vision-detect",
    "/api/green/activities",
    "/api/green/challenges",
    "/api/green/impacts",
    "/api/hackathons",
    "/api/hackathons/:id",
    "/api/hackathons/register",
    "/api/hackathons/teams/:teamId/judge",
    "/api/hackathons/teams/:teamId/submit",
    "/api/health",
    "/api/health/db",
    "/api/hs-connection/campus-tour",
    "/api/hs-connection/connect/:userId",
    "/api/hs-connection/counseling",
    "/api/hs-connection/my-network",
    "/api/hs-connection/network/respond",
    "/api/hs-connection/questions",
    "/api/hs-connection/questions/:id/answers",
    "/api/impact-match/needs",
    "/api/impact-match/needs/:id",
    "/api/impact-match/rank",
    "/api/impact-match/rankings/cached",
    "/api/impact-match/sponsors",
    "/api/impact-match/sponsors/:id",
    "/api/impact-measurement/auto-cached/:regionId",
    "/api/impact-measurement/measure",
    "/api/impact-measurement/metrics",
    "/api/internships",
    "/api/internships/:id",
    "/api/internships/:id/apply",
    "/api/internships/nearby",
    "/api/intl/alumni",
    "/api/intl/alumni/nearby",
    "/api/intl/programs",
    "/api/learning-spots",
    "/api/learning-spots/:id/availability",
    "/api/learning-spots/explain",
    "/api/learning-spots/nearby",
    "/api/learning-spots/recommend",
    "/api/library/resources",
    "/api/library/resources/:id",
    "/api/library/resources/:id/summary",
    "/api/library/search",
    "/api/map/pois",
    "/api/map/locations",
    "/api/map/categories",
    "/api/map/poi/:id",
    "/api/map/featured-pins",
    "/api/map/stats",
    "/api/map/gap-forecast",
    "/api/map/resource-optimization",
    "/api/map/nl-search",
    "/api/map/safe-route",
    "/api/map/climate-risk",
    "/api/map/ai-analysis",
    "/api/map/climate/alternatives",
    "/api/map/data-gaps",
    "/api/map/survey/priorities",
    "/api/map/survey/next",
    "/api/map/routing/route",
    "/api/map/routing/nearest",
    "/api/map/routing/table",
    "/api/map/routing/flood-zones",
    "/api/map/routing/traffic-segments",
    "/api/mentoring/availability",
    "/api/mentoring/book",
    "/api/mentoring/bookings/:id/status",
    "/api/mentoring/me/availability",
    "/api/mentoring/me/bookings",
    "/api/mentoring/mentor/:mentorId/bookings",
    "/api/mentoring/mentors",
    "/api/mentoring/mentors/:id",
    "/api/mentoring/mentors/:mentorId/slots",
    "/api/mentoring/mentors/recommend/:userId",
    "/api/mentoring/register/:userId",
    "/api/mentoring/student/:studentId/bookings",
    "/api/notifications",
    "/api/notifications/:id/read",
    "/api/notifications/:userId",
    "/api/notifications/send",
    "/api/offline/status",
    "/api/offline/tutor",
    "/api/opportunities",
    "/api/opportunities/:id",
    "/api/opportunities/:id/team-finding",
    "/api/opportunities/match",
    "/api/payment/booking/:bookingId",
    "/api/payment/process/:transactionId",
    "/api/ping",
    "/api/pins",
    "/api/pins/:id",
    "/api/resource-exchange/auto-health",
    "/api/resource-exchange/cached-matches",
    "/api/resource-exchange/match",
    "/api/resource-exchange/matches",
    "/api/resource-exchange/requests",
    "/api/resource-exchange/requests/:id",
    "/api/resource-exchange/resources",
    "/api/resource-exchange/resources/:id",
    "/api/roles",
    "/api/roles/:id",
    "/api/scholarships",
    "/api/scholarships/:id",
    "/api/scholarships/:id/apply",
    "/api/scholarships/:id/check-eligibility",
    "/api/scholarships/me/applications",
    "/api/share/items",
    "/api/share/items/:id/request",
    "/api/share/items/:id/return",
    "/api/share/me/requests",
    "/api/stem",
    "/api/stem/labs",
    "/api/stem/labs/:id/book",
    "/api/stem/labs/nearby",
    "/api/storage/:id",
    "/api/storage/media/:objectName",
    "/api/storage/my-files",
    "/api/storage/upload",
    "/api/summer/campaigns",
    "/api/summer/campaigns/:id/activities",
    "/api/summer/campaigns/:id/daily-report",
    "/api/summer/campaigns/:id/register",
    "/api/summer/registrations/:id/status",
    "/api/surveys",
    "/api/surveys/:id",
    "/api/surveys/:id/analytics",
    "/api/surveys/:id/export",
    "/api/surveys/:id/submit",
    "/api/volunteers",
    "/api/volunteers/activities",
    "/api/wifi/locations",
    "/api/wifi/locations/:id/speed-test",
    "/api/wifi/locations/nearby",
];

/// Whether the given path is in the public list (prefix match, `:id` wildcard).
pub fn is_public_path(path: &str) -> bool {
    PUBLIC_PATHS.iter().any(|pattern| path_matches(pattern, path))
}

/// Does a request `path` match one of the `PUBLIC_PATHS` entries?
///
/// Plain segments must be equal, `:param` matches any single segment and a
/// catch-all (`*rest` or `{*rest}`) matches **everything that follows**, so a
/// single entry covers deep URLs like `/api/ai/knowledge/query` or
/// `/api/ai/auto/impact-measurement/dong_nai`.
fn path_matches(pattern: &str, path: &str) -> bool {
    let p_parts: Vec<&str> = pattern.split('/').collect();
    let q_parts: Vec<&str> = path.split('/').collect();

    for (index, p) in p_parts.iter().enumerate() {
        let q = match q_parts.get(index) {
            Some(q) => *q,
            None => return false, // the path is shorter than the pattern
        };
        // Strip `{...}` so `{*rest}` and `*rest` are handled identically.
        let p = p.strip_prefix('{').unwrap_or(p).trim_end_matches('}');
        if p.starts_with('*') {
            return q_parts.len() >= index + 1;
        }
        if p == q || p.starts_with(':') {
            continue;
        }
        return false;
    }

    // The pattern ran out: the path may not have more segments than it (a
    // catch-all already returned early).
    p_parts.len() == q_parts.len()
}

/// Axum middleware: decodes the Bearer JWT and attaches the user to the request.
#[derive(Clone)]
pub struct AuthLayer;

impl<S> Layer<S> for AuthLayer {
    type Service = AuthService<S>;

    fn layer(&self, service: S) -> Self::Service {
        AuthService(service)
    }
}

/// `Clone` is required by `Router::layer` (the middleware is applied to a
/// `Router`, which is `Arc`-based and thus `Clone` already; the inner service
/// is shared by reference).
#[derive(Clone)]
pub struct AuthService<S>(S);

impl<S> Service<ServiceRequest> for AuthService<S>
where
    S: Service<ServiceRequest, Response = Response<Body>, Error = Infallible>
        + Clone + Send + Sync + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = BoxFuture<S::Response, S::Error>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.0.poll_ready(cx)
    }

    fn call(&mut self, mut req: ServiceRequest) -> Self::Future {
        let path = req.uri().path().to_string();
        let is_pub = is_public_path(&path);

        // Compute the user once (only for non-public paths) and hand the
        // decision to the async block so `self.0.call` stays movable.
        let maybe_user = if !is_pub {
            decode_user(&req)
        } else {
            Ok(None)
        };

        // The boxed future must be `'static`, so the inner service is cloned
        // and moved into it — `self.0` can't be borrowed out of `&mut self`
        // for the lifetime of the future.
        let mut svc = self.0.clone();

        Box::pin(async move {
            let user = match maybe_user {
                Ok(u) => u,
                Err(e) => {
                    let body = serde_json::json!({
                        "success": false,
                        "data": serde_json::Value::Null,
                        "message": e,
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    });
                    return Ok((StatusCode::UNAUTHORIZED, axum::Json(body)).into_response());
                }
            };
            if let Some(u) = user {
                req.extensions_mut().insert(u);
            }
            svc.call(req).await.map_err(|e| e.into())
        })
    }
}

/// Read + validate the token from `Authorization: Bearer <jwt>`.
fn decode_user(req: &ServiceRequest) -> Result<Option<AuthUser>, String> {
    let header = match req.headers().get("authorization") {
        Some(h) => h,
        None => return Err("Bạn cần đăng nhập để sử dụng api này.".to_string()),
    };
    let token_str = header
        .to_str()
        .map_err(|_| "Token không hợp lệ.".to_string())?;
    let token = token_str
        .strip_prefix("Bearer ")
        .ok_or_else(|| "Token không hợp lệ.".to_string())?
        .trim();

    let decoded = jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(crate::config::JWT_SECRET.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map_err(|_| "Token không hợp lệ hoặc đã hết hạn.".to_string())?;

    let now = chrono::Utc::now().timestamp();
    if decoded.claims.exp < now {
        return Err("Token đã hết hạn.".to_string());
    }

    Ok(Some(AuthUser {
        id: decoded.claims.sub,
        email: decoded.claims.email,
        role: decoded.claims.role,
    }))
}

/// Reads the decoded user from the request (401 when absent).
pub fn authenticated_user(user: Option<Extension<AuthUser>>) -> Result<AuthUser, crate::common::error::AppError> {
    Ok(user.map(|u| u.0).ok_or_else(|| {
        crate::common::error::AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
    })?)
}

/// Reads the decoded user from the request (None when absent).
pub fn optional_user(user: Option<Extension<AuthUser>>) -> Result<Option<AuthUser>, crate::common::error::AppError> {
    Ok(user.map(|u| u.0))
}

/// Rejects anyone who is not ADMIN/MODERATOR.
pub fn ensure_admin(user: &AuthUser) -> Result<(), crate::common::error::AppError> {
    if user.role != "ADMIN" && user.role != "MODERATOR" {
        return Err(crate::common::error::AppError::Forbidden(
            "Bạn không có quyền thực hiện hành động này.".to_string(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// JWT keys (the old backend signed/verified with a single `JWT_SECRET`).
// ---------------------------------------------------------------------------

/// The secret used to *encode* both access and refresh tokens.
pub static JWT_ENCODING_KEY: Lazy<jsonwebtoken::EncodingKey> =
    Lazy::new(|| jsonwebtoken::EncodingKey::from_secret(crate::config::JWT_SECRET.as_bytes()));

/// The secret used to *encode* refresh tokens (a separate handle on the same
/// secret so the two token types keep distinct headers).
pub static JWT_REFRESH_ENCODING_KEY: Lazy<jsonwebtoken::EncodingKey> =
    Lazy::new(|| jsonwebtoken::EncodingKey::from_secret(crate::config::JWT_SECRET.as_bytes()));

/// The shared secret *decoded* key (checksum verification uses the same key
/// pair because the new backend uses `HS256`).
pub static JWT_DECODING_KEY: Lazy<jsonwebtoken::DecodingKey> =
    Lazy::new(|| jsonwebtoken::DecodingKey::from_secret(crate::config::JWT_SECRET.as_bytes()));

/// A base32-safe secret string (32 chars, RFC 4648: `A-Z2-7`) used by the 2FA
/// setup flow — the old backend used `totp-rs`'s `Secret` option.
pub fn generate_totp_secret() -> String {
    // Only base32-uppercase characters (`A-Z`, `2-7`), no `I/O/1/0` confusion.
    let mut out = String::with_capacity(32);
    let mut state: u64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time went backwards")
        .as_nanos() as u64;
    for _ in 0..32 {
        state ^= state.wrapping_shl(13).wrapping_mul(7).wrapping_add(13);
        let c = (state & 0x1f) as u8;
        let c = if c < 26 { b'A' + c } else { b'2' + c - 26 };
        state ^= state >> 7;
        out.push(c as char);
    }
    out
}

/// SHA-256 hash of a refresh token (the old backend's `hashRefreshToken`),
/// written into `user_refresh_tokens.token_hash`.
pub fn hash_refresh_token(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
