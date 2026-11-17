//! Postgres pool using `sqlx` (Postgres + PostGIS).
//!
//! Retries until the DB is up (startup health check); the pool is shared
//! (`Arc`) across handlers via `State`.
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct DbPool {
    inner: PgPool,
}

impl DbPool {
    /// Connect to the DSN (built by `Config::db_url`), retrying until the DB
    /// is available — the containers start in sequence (db first).
    /// `statement_cache_capacity(0)` disables sqlx's prepared-statement cache,
    /// which is required when the DSN points at a PgBouncer in transaction
    /// mode (Supabase's default) — otherwise sqlx reuses a statement that
    /// PgBouncer has already discarded and returns
    /// "prepared statement sqlx_s_N already exists".
    pub async fn connect(url: &str) -> Self {
        let mut attempt = 0;
        let mut last = None;

        while attempt < 60 {
            attempt += 1;
            let result = PgPoolOptions::new()
                .max_connections(10)
                .statement_cache_capacity(0)
                .acquire_timeout(Duration::from_secs(10))
                .connect(url)
                .await;
            match result {
                Ok(pool) => {
                    tracing::info!("database pool connected (attempt {attempt})");
                    return Self { inner: pool };
                }
                Err(e) => {
                    tracing::warn!(
                        "database connection attempt {}/60: {}",
                        attempt,
                        e
                    );
                    last = Some(e);
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

/// Quick check that the pool can query the database (a harmless `SELECT 1`).
pub async fn is_healthy(pool: &DbPool) -> bool {
    use sqlx::Executor;
    pool.db()
        .execute(sqlx::query("SELECT 1"))
        .await
        .is_ok()
}
