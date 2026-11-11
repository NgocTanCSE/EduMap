//! Logging initialisation — JSON output for structured production logs.
//!
//! Mirrors the previous NestJS logging setup (`logging.interceptor.ts` +
//! `request-logging.middleware.ts`); request-level tracing is now handled by
//! the axum `tracing` layer in `router.rs`.
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging() {
    let fmt = tracing_subscriber::fmt::layer()
        .json()
        .flatten_event(true)
        .with_span_list(false);

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx_query=warn"));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt)
        .init();
}