//! Database layer: the Postgres (PostGIS) pool.
//!
//! `query()` below forces sqlx to use an **unnamed** prepared statement
//! (`persistent(false)`). Supabase's PgBouncer runs in transaction mode,
//! where named statements (`sqlx_s_N`) collide across pooled server
//! connections and surface as `prepared statement "sqlx_s_N" already exists`.
//! Unnamed statements carry no server-side name, so pooling is safe.
//!
//! Call sites use `crate::db::query(...)` instead of `sqlx::query(...)`.
//!
//! `text()` / `opt_text()` / `num()` / `opt_num()` replace `row.get::<T, _>()`
//! for JSON serialisation. `Row::get` panics when the column type does not
//! match the Rust type — UUID columns read as `String`, `TIMESTAMPTZ` read as
//! `String`, `NUMERIC` read as `f64`. Those panics abort the whole server
//! (`panic = "unwind"` keeps it alive but the endpoint still fails), so the
//! readers below try every plausible representation and fall back instead.

pub mod pool;

use sqlx::query::Query;
use sqlx::postgres::PgRow;
use sqlx::{database::HasStatementCache, Database, Row};

/// `sqlx::query` equivalent that never keeps a named prepared statement.
pub fn query<'q, DB>(sql: &'q str) -> Query<'q, DB, <DB as Database>::Arguments<'q>>
where
    DB: Database + HasStatementCache,
{
    sqlx::query::<DB>(sql).persistent(false)
}

fn as_text<T>(value: T) -> String
where
    T: ToString,
{
    value.to_string()
}

/// Read a column as `String`, accepting text/UUID/timestamp/number columns.
pub fn text(row: &PgRow, col: &str) -> String {
    if let Ok(v) = row.try_get::<String, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<uuid::Uuid, _>(col) {
        return v.to_string();
    }
    if let Ok(v) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(col) {
        return v.to_rfc3339();
    }
    if let Ok(v) = row.try_get::<chrono::NaiveDateTime, _>(col) {
        return v.to_string();
    }
    if let Ok(v) = row.try_get::<serde_json::Value, _>(col) {
        return v.to_string();
    }
    if let Ok(v) = row.try_get::<i64, _>(col) {
        return as_text(v);
    }
    if let Ok(v) = row.try_get::<i32, _>(col) {
        return as_text(v);
    }
    if let Ok(v) = row.try_get::<f64, _>(col) {
        return as_text(v);
    }
    if let Ok(v) = row.try_get::<bool, _>(col) {
        return as_text(v);
    }
    String::new()
}

/// `Option<String>` counterpart of [`text`].
pub fn opt_text(row: &PgRow, col: &str) -> Option<String> {
    if let Ok(v) = row.try_get::<Option<String>, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<uuid::Uuid>, _>(col) {
        return v.map(|u| u.to_string());
    }
    if let Ok(v) = row.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(col) {
        return v.map(|d| d.to_rfc3339());
    }
    if let Ok(v) = row.try_get::<Option<chrono::NaiveDateTime>, _>(col) {
        return v.map(|d| d.to_string());
    }
    if let Ok(v) = row.try_get::<Option<serde_json::Value>, _>(col) {
        return v.map(|j| j.to_string());
    }
    if let Ok(v) = row.try_get::<Option<i64>, _>(col) {
        return v.map(as_text);
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(col) {
        return v.map(as_text);
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(col) {
        return v.map(as_text);
    }
    if let Ok(v) = row.try_get::<Option<bool>, _>(col) {
        return v.map(as_text);
    }
    None
}

/// Read a column as `f64`, accepting float/int/numeric-as-text columns.
pub fn num(row: &PgRow, col: &str) -> f64 {
    if let Ok(v) = row.try_get::<f64, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<i64, _>(col) {
        return v as f64;
    }
    if let Ok(v) = row.try_get::<i32, _>(col) {
        return v as f64;
    }
    if let Some(s) = opt_text(row, col) {
        if let Ok(v) = s.parse::<f64>() {
            return v;
        }
    }
    0.0
}

/// `Option<f64>` counterpart of [`num`].
pub fn opt_num(row: &PgRow, col: &str) -> Option<f64> {
    if let Ok(v) = row.try_get::<Option<f64>, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<i64>, _>(col) {
        return v.map(|x| x as f64);
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(col) {
        return v.map(|x| x as f64);
    }
    opt_text(row, col).and_then(|s| s.parse::<f64>().ok())
}

/// Read a column as `i64`, accepting int/float/numeric-as-text columns and NULL.
pub fn int(row: &PgRow, col: &str) -> i64 {
    if let Ok(v) = row.try_get::<i64, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<i32, _>(col) {
        return v as i64;
    }
    if let Ok(v) = row.try_get::<f64, _>(col) {
        return v as i64;
    }
    if let Some(s) = opt_text(row, col) {
        if let Ok(v) = s.parse::<i64>() {
            return v;
        }
        if let Ok(v) = s.parse::<f64>() {
            return v as i64;
        }
    }
    0
}

/// `Option<i64>` counterpart of [`int`].
pub fn opt_int(row: &PgRow, col: &str) -> Option<i64> {
    if let Ok(v) = row.try_get::<Option<i64>, _>(col) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(col) {
        return v.map(|x| x as i64);
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(col) {
        return v.map(|x| x as i64);
    }
    opt_text(row, col).and_then(|s| s.parse::<i64>().ok())
}
