//! Authentication (JWT): the NestJS `passport-jwt` + `RolesGuard` port.
//!
//! The middleware layer (`AuthLayer`) extracts `Authorization: Bearer <jwt>`,
//! decodes it, and merges the claims (`id / email / role`) into the request
//! extensions so handlers can read them (`user.id`, `user.role`).
use axum::body::Body;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::pin::Pin;
use std::task::{Context, Poll};
use tower::Layer;
use tower::Service;

/// The full request type used by `tower::Service` in axum.
type ServiceRequest = axum::http::Request<Body>;
type BoxFuture =
    Pin<Box<dyn std::future::Future<Output = Result<Response, Box<dyn Error + Send + Sync>>> + Send>>;

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
    "/api/ai/chat/stream",
    "/api/ai/history",
    "/api/ai/search",
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

fn path_matches(pattern: &str, path: &str) -> bool {
    let p_parts: Vec<&str> = pattern.split('/').collect();
    let q_parts: Vec<&str> = path.split('/').collect();
    if p_parts.len() != q_parts.len() {
        return false;
    }
    p_parts
        .iter()
        .zip(q_parts.iter())
        .all(|(p, q)| *p == *q || p.starts_with(':'))
}

/// Axum middleware: decodes the Bearer JWT and attaches the user to the request.
pub struct AuthLayer;

impl<S> Layer<S> for AuthLayer {
    type Service = AuthService<S>;

    fn layer(&self, service: S) -> Self::Service {
        AuthService(service)
    }
}

struct AuthService<S>(S);

impl<S, B> Service<ServiceRequest> for AuthService<S>
where
    S: Service<ServiceRequest, Response = Response<B>> + Send + 'static,
    S::Future: Send + 'static,
    B: Into<Body> + Send + 'static,
{
    type Response = S::Response;
    type Error = Box<dyn Error + Send + Sync>;
    type Future = BoxFuture;

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
            self.0.call(req).await.map_err(|e| e.into())
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
pub fn authenticated_user(req: &ServiceRequest) -> Result<AuthUser, crate::common::error::AppError> {
    req.extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or_else(|| {
            crate::common::error::AppError::Unauthorized("Bạn cần đăng nhập để sử dụng api này.".to_string())
        })
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