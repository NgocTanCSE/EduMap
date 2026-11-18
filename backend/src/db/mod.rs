//! Database layer: the Postgres (PostGIS) pool.
//!
//! `query()` below forces sqlx to use an **unnamed** prepared statement
//! (`persistent(false)`). Supabase's PgBouncer runs in transaction mode,
//! where named statements (`sqlx_s_N`) collide across pooled server
//! connections and surface as `prepared statement "sqlx_s_N" already exists`.
//! Unnamed statements carry no server-side name, so pooling is safe.
//!
//! Call sites use `crate::db::query(...)` instead of `sqlx::query(...)`.

pub mod pool;

use sqlx::query::Query;
use sqlx::{database::HasStatementCache, Database};

/// `sqlx::query` equivalent that never keeps a named prepared statement.
pub fn query<'q, DB>(sql: &'q str) -> Query<'q, DB, <DB as Database>::Arguments<'q>>
where
    DB: Database + HasStatementCache,
{
    sqlx::query::<DB>(sql).persistent(false)
}