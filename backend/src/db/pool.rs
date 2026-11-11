//! Postgres pool using `sqlx` (Postgres + PostGIS).
//!
//! Retries until the DB is up (startup health check); the pool is shared
//! (`Arc`) across handlers via `State`.
use sqlx::PgPool;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct DbPool {
    inner: PgPool,
}

impl DbPool {
    /// Connect to the DSN (built by `Config::db_url`), retrying until the DB
    /// is available — the containers start in sequence (db first).
    pub async fn connect(url: &str) -> Self {
        let mut attempt = 0;
        let mut last = None;

        while attempt < 60 {
            attempt += 1;
            match sqlx::PgPool::connect(url).await {
                Ok(pool) => {
                    tracing::info!("database pool connected (attempt {attempt})");
                    return Self { inner: pool };
                }
                Err(e) => {
                    last = Some(e);
                    tracing::warn!(
                        "database connection attempt {}/60: {}",
                        attempt,
                        e
                    );
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }

        panic!(
            "database connection failed after {} attempts: {:?}",
            attempt,
            last
        );
    }

    /// Expose the raw pool (used by sqlx queries in repositories).
    pub fn db(&self) -> &PgPool {
        &self.inner
    }
}

/// Quick check that the pool can query the database.
pub async fn is_healthy(pool: &DbPool) -> bool {
    pool.db()
        .ping()
        .await
        .map(|_| true)
        .unwrap_or(false)
}
