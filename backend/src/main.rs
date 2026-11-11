mod config;
mod common;
mod db;
mod dto;
mod modules;
mod router;

use common::logging::init_logging;
use config::Config;
use db::pool::DbPool;
use router::create_router;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // 1. logging
    init_logging();
    tracing::info!("starting edumap-backend (Rust/axum)");

    // 2. configuration
    let config = Config::from_env();
    tracing::info!("configuration loaded");

    // 3. database pool (retry until the DB is up)
    let pool = DbPool::connect(&config.db_url).await;
    tracing::info!("database pool connected");

    // 4. in-process notification hub (installed before the router is built so
    // `subscribe_sse` can register the streams of the upcoming connections).
    crate::common::notifications::init_hub(crate::common::notifications::NotificationHub::new());
    tracing::info!("notification hub initialized");

    // 5. router (mounts all routes + auth middleware)
    let app = create_router(pool);

    // 5. serve (port 3000, same as the previous NestJS backend)
    let addr: SocketAddr = format!("0.0.0.0:{}", config.port).parse().unwrap();
    tracing::info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("server error: {}", e);
        std::process::exit(1);
    }
}
