/// Application configuration — read from env vars, validated.
///
/// The backend already ran on env vars (`DB_*`, `JWT_SECRET`, `AI_SERVICE_URL`,
/// `ROUTING_SERVICE_URL`); these are preserved so the deployed `.env`/HF
/// Secrets work unchanged.
use once_cell::sync::Lazy;

#[derive(Debug, Clone)]
pub struct Config {
    /// Port the backend listens on (3000 in production, unchanged from NestJS).
    pub port: u16,
    /// Postgres DSN (built from DB_* or a direct DATABASE_URL).
    pub db_url: String,
    /// Secret used to sign/verify JWTs (same value as `JWT_SECRET`).
    pub jwt_secret: String,
    /// Host of the FastAPI ai-service (port 8000, in-container).
    pub ai_service_url: String,
    /// Timeout for requests to the AI service (seconds).
    pub ai_service_timeout: u64,
    /// SMTP host for the mailer.
    pub smtp_host: String,
    /// SMTP port for the mailer.
    pub smtp_port: u16,
}

/// Cached, always available JWT secret (shared across the stateless handlers).
pub static JWT_SECRET: Lazy<String> = Lazy::new(|| env_var_or("JWT_SECRET", "dev-change-me"));

/// Cached, always available ai-service host (the FastAPI `ai-service`, port
/// 8000 in-container).
pub static AI_SERVICE_URL: Lazy<String> = Lazy::new(|| env_var_or("AI_SERVICE_URL", "http://127.0.0.1:8000"));

/// Cached, always available routing host (OSRM/ORS, port 5000 in-container).
pub static ROUTING_SERVICE_URL: Lazy<String> = Lazy::new(|| env_var_or("ROUTING_SERVICE_URL", "http://127.0.0.1:5000"));

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: Self::port(),
            db_url: Self::database_url(),
            jwt_secret: Self::jwt_secret(),
            ai_service_url: Self::ai_service_url(),
            ai_service_timeout: Self::ai_service_timeout(),
            smtp_host: Self::smtp_host(),
            smtp_port: Self::smtp_port(),
        }
    }

    /// Build the Postgres DSN (matches the previous `DB_*` env vars).
    fn db_url() -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            env_var_or("DB_USERNAME", "admin"),
            env_var_or("DB_PASSWORD", "password123"),
            env_var_or("DB_HOST", "localhost"),
            env_var_or("DB_PORT", "5432"),
            env_var_or("DB_DATABASE", "edumap_db"),
        )
    }

    /// Direct `DATABASE_URL` takes precedence (bypasses DB_*).
    fn database_url() -> String {
        env_var_or("DATABASE_URL", Self::db_url())
    }

    fn port() -> u16 {
        env_var_or("BACKEND_PORT", "3000").parse().unwrap_or(3000)
    }

    fn jwt_secret() -> String {
        env_var_or("JWT_SECRET", "dev-change-me")
    }

    fn ai_service_url() -> String {
        env_var_or("AI_SERVICE_URL", "http://127.0.0.1:8000")
    }

    fn ai_service_timeout() -> u64 {
        env_var_or("AI_SERVICE_TIMEOUT", "45").parse().unwrap_or(45)
    }

    fn smtp_host() -> String {
        env_var_or("SMTP_HOST", "smtp.gmail.com")
    }

    fn smtp_port() -> u16 {
        env_var_or("SMTP_PORT", "587").parse().unwrap_or(587)
    }
}

/// Env lookup with a sane default (never panics).
pub fn env_var_or(key: &str, default: &str) -> String {
    ::std::env::var(key).unwrap_or_else(|_| default.to_string())
}
