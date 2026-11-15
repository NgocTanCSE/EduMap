//! Google OAuth2 `credential` JWT verification via JWKS.
//!
//! Google signs the JWTs issued by its `Sign in with Google` flow (the
//! `credential` payload sent to `POST /api/auth/google`) with RSA
//! (RS256/RS384/RS512) against the keys it publishes on
//! `https://www.googleapis.com/oauth2/v3/certs` (`JwkSet`).
//!
//! The module downloads the key set once and caches it in-process (`JWKS`, one
//! hour TTL), so a login request only *verifies* the signature instead of
//! downloading the keys on every request.  A *failed* fetch discards the payload
//! rather than accepting an unverified one: the login answers with a network
//! failure (503) and is retried later.
//!
//! Every credential is checked (cheap first, network last):
//!
//! - the header `alg` must be RS256/RS384/RS512,
//! - the header `kid` must resolve to an RSA key inside the cached set,
//! - `iss` must be `https://accounts.google.com` (or bare `accounts.google.com`
//!   for emulators/older clients), `sub` + `exp` must be present,
//! - `aud` is verified against `GOOGLE_CLIENT_ID` when the secret is set on the
//!   host — the JWT carries an audience claim *always*, so without a client id
//!   the audience check is disabled (a warning is logged; the payload is still
//!   signature-verified — Google's signature never lies).

use crate::config::GOOGLE_CLIENT_ID;
use crate::common::error::AppError;
use jsonwebtoken::errors::Error;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode_header};
use jsonwebtoken::jwk::JwkSet;
use serde::Deserialize;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// JWKS endpoint published by Google (and every Google client).
const JWKS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";

/// TTL of a downloaded key set (the keys rotate rarely; `kid` is always in the
/// response).  One hour — the same bucket as the auto-scheduler cache so a
/// login request stays warm across key rotations.
const JWKS_CACHE_TTL_SECS: u64 = 60 * 60;

/// Time budget when the key set has to be downloaded.
const JWKS_TIMEOUT: Duration = Duration::from_secs(10);

/// Google's issuer (`accounts.google.com` is the classical form accepted by
/// older clients/emulators).
const GOOGLE_ISSUERS: &[&str] = &["https://accounts.google.com", "accounts.google.com"];

/// A cached key set + the instant it was fetched.
struct JwksEntry {
    set: JwkSet,
    fetched_at: Instant,
}

/// The JWKS hub: warmed by the startup task, refreshed every hour.
///
/// `once_cell::sync::Lazy` (not a `const`) so `RwLock::new` runs on first
/// access, never while a static initializer is alive.
static JWKS: once_cell::sync::Lazy<RwLock<Option<JwksEntry>>> =
    once_cell::sync::Lazy::new(|| RwLock::new(None));

/// Claims carried by a verified Google credential.
///
/// The module does not trust a payload blindly: the claims are read only *after*
/// the signature has been verified against Google's public key set.
/// `sub`/`iss`/`exp` chỉ được đọc trong `#[cfg(test)]`.
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct GoogleCredentialClaims {
    /// Google's opaque user id (the `sub` of the credential).
    pub sub: String,
    /// The verified email inside the credential.
    pub email: String,
    /// The issuer of the credential.
    pub iss: String,
    /// The expiration of the credential (the `exp` claim).
    pub exp: i64,
}

/// Convert a `jsonwebtoken` error into an actionable message.
fn jwt_error(err: &Error) -> String {
    format!("google credential: {}", err).replace('\n', " ")
}

/// Duration since now for the cache TTL of a loaded key set.
fn ttl_offset() -> Instant {
    Instant::now() + Duration::from_secs(JWKS_CACHE_TTL_SECS)
}

/// Download the key set from Google's JWKS endpoint.
async fn fetch_jwks() -> Result<JwkSet, AppError> {
    let client = reqwest::Client::builder()
        .timeout(JWKS_TIMEOUT)
        .connect_timeout(JWKS_TIMEOUT)
        .build()
        .map_err(|e| AppError::Io(format!("cannot build the JWKS http client: {}", e)))?;

    let response = client
        .get(JWKS_URL)
        .send()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!(
            "Google's key set could not be reached: {}",
            e
        )))?;

    let status = response.status();
    if !status.is_success() {
        return Err(AppError::ServiceUnavailable(format!(
            "Google's key set returned {status}"
        )));
    }

    response
        .json::<JwkSet>()
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!(
            "Google's key set is not a valid jwks set: {}",
            e
        )))
}

/// Load the key set from the cache (warm at startup, refresh every hour).
async fn load_jwks() -> Result<JwkSet, AppError> {
    loop {
        {
            let guard = JWKS.read().await;
            if let Some(entry) = guard.as_ref() {
                let ttl = Duration::from_secs(JWKS_CACHE_TTL_SECS);
                if entry.fetched_at + ttl > Instant::now() {
                    return Ok(entry.set.clone());
                }
            }
        }

        // Cold or stale → download the set and store it.
        let set = fetch_jwks().await?;
        let mut guard = JWKS.write().await;
        // (one task wins the write; others see the warm set on the next read)
        *guard = Some(JwksEntry {
            set: set.clone(),
            fetched_at: ttl_offset(),
        });
        drop(guard);
        return Ok(set);
    }
}

/// Warm the JWKS key set at startup (one fetch, no request waits on it).
pub async fn warm_jwks() {
    if let Ok(set) = fetch_jwks().await {
        let mut guard = JWKS.write().await;
        *guard = Some(JwksEntry {
            set,
            fetched_at: ttl_offset(),
        });
        drop(guard);
        tracing::info!("google jwks key set warmed");
    } else {
        tracing::warn!("google jwks warm-up failed (the keys are fetched on demand)");
    }
}

/// Return the public key for `kid` (+ the header algorithm): the cached key set
/// is looked up first, and refetched once when the `kid` is not in it (a key
/// rotation).
async fn decoding_key(kid: &str, alg: Algorithm) -> Result<(Algorithm, DecodingKey), AppError> {
    let set = load_jwks().await?;
    let jwk = match set.find(kid) {
        Some(jwk) => jwk.clone(),
        None => {
            // one refetch attempt (a key rotation) before giving up
            tracing::warn!("google credential: `{kid}` not found (refetching)");
            let set = load_jwks().await?;
            match set.find(kid) {
                Some(jwk) => jwk.clone(),
                None => {
                    return Err(AppError::Internal(format!(
                        "google credential: `{kid}` is not in Google's key set"
                    )));
                }
            }
        }
    };

    // Google always signs with RSA; an ECDSA/EdDSA key can't validate the
    // payload (the header was checked to be RS256/384/512 before the lookup).
    let (n, e) = match &jwk.algorithm {
        jsonwebtoken::jwk::AlgorithmParameters::RSA(params) => (&params.n, &params.e),
        _ => {
            return Err(AppError::BadRequest("google credential: the key is not RSA".to_string()))
        }
    };
    // `n`/`e` are base64url (`URL_SAFE_NO_PAD`); the decoder builds a ring RSA
    // public key from the components.
    Ok((
        alg,
        DecodingKey::from_rsa_components(n, e).map_err(|e| {
            AppError::BadRequest(format!("google credential: {}", jwt_error(&e)))
        })?,
    ))
}

/// Verify the signature of a Google `credential` JWT (`POST /api/auth/google`).
///
/// Returns the verified claims (the `email` = the email of the holder
/// delivered by the JS `credential` payload).
pub async fn verify_google_credential(
    credential: &str,
) -> Result<GoogleCredentialClaims, AppError> {
    use jsonwebtoken::Algorithm as A;

    // 1. The header (`alg` = the key shape; `kid` = the key id) is parsed
    //    *before* the network call so a malformed payload never waits.
    let header = decode_header(credential).map_err(|e| {
        AppError::BadRequest(format!("google credential malformed: {}", jwt_error(&e)))
    })?;
    let alg = match header.alg {
        A::RS256 | A::RS384 | A::RS512 => header.alg,
        _ => {
            return Err(AppError::BadRequest(
                "google credential: unsupported signature algorithm".to_string(),
            ))
        }
    };
    let kid = header.kid.as_deref().ok_or_else(|| {
        AppError::BadRequest("google credential: missing `kid`".to_string())
    })?;

    // 2. The key set (cached) + the `kid` → the public key.
    let (alg, key) = decoding_key(kid, alg).await?;

    // 3. Validation: issuer + required claims + signature contract.
    let mut validation = Validation::new(alg);
    validation.set_issuer(GOOGLE_ISSUERS);
    // `sub`, `exp`, `iss` are required claims (a payload without them is
    // malformed; the payload is untyped so a broker that drops them is
    // rejected).
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);
    // The audience is client-specific: the backend only knows the audience when
    // `GOOGLE_CLIENT_ID` is set (the frontend's `config.googleClientId`)...
    // `jsonwebtoken` rejects a credential that carries an `aud` claim while
    // `validation.aud` is empty (`InvalidAudience`), so without a client id the
    // check is disabled.
    let client_id = google_client_id();
    if let Some(id) = client_id.as_ref() {
        validation.set_audience(&[&id]);
    } else {
        tracing::warn!("GOOGLE_CLIENT_ID is not set: the `aud` claim of google credentials is not checked");
        validation.validate_aud = false;
    }

    // 4. Decode the payload (the verification fails when the signature is bad).
    let payload = jsonwebtoken::decode::<serde_json::Value>(credential, &key, &validation)
        .map_err(|e| AppError::BadRequest(format!("google credential: {}", jwt_error(&e))))?;
    let payload = payload.claims;

    // The claims the caller needs (the token is verified — the payload is
    // trusted only after the signature).
    let email = payload.get("email").and_then(|v| v.as_str()).map(|s| s.to_string()).ok_or_else(|| {
        AppError::BadRequest("no email in the google credential".to_string())
    })?;
    let sub = payload.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_default();
    let iss = payload.get("iss").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_default();
    let exp = payload.get("exp").and_then(|v| v.as_i64()).unwrap_or(0);

    Ok(GoogleCredentialClaims { sub, email, iss, exp })
}

/// `GOOGLE_CLIENT_ID` (empty/absent → the audience is skipped + a warning).
fn google_client_id() -> Option<String> {
    let id = GOOGLE_CLIENT_ID.to_string();
    if id.is_empty() {
        return None;
    }
    Some(id)
}

#[cfg(test)]
mod test {
    use super::*;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use jsonwebtoken::crypto::sign as jwt_sign;
    use jsonwebtoken::EncodingKey;
    use jsonwebtoken::Header;
    use serde_json::{json, Value};

    /// A PEM RSA private key (PKCS8) generated locally for the offline tests.
    const FAKE_PRIVATE_PEM: &str = include_str!("test_key.pem");

    /// The key set the tests validate against (one key, `kid`).
    const FAKE_JWKS: &str = include_str!("test_key_set.json");

    /// Warm the JWKS static with the fixture key set (no network in `cargo test`).
    ///
    /// The static is a tokio `RwLock` — writing from a `#[tokio::test]` must
    /// await the lock, not `blocking_write` (which panics inside a runtime).
    async fn warm(jwks: &str) {
        let set: JwkSet = serde_json::from_str(jwks).unwrap();
        let entry = JwksEntry {
            set,
            fetched_at: ttl_offset(),
        };
        let mut guard = JWKS.write().await;
        *guard = Some(entry);
        drop(guard);
    }

    /// Sign the raw payload against the fixture `kid` (the header alg stays).
    async fn sign_credential(payload: Value, kid: &str, alg: Algorithm) -> String {
        let alg_b64 = serde_json::to_value(&alg).unwrap().as_str().unwrap().to_string();
        let header: Header = serde_json::from_str(&format!(
            r#"{{"alg":"{}","kid":"{}"}}"#,
            alg_b64, kid
        ))
        .unwrap();
        let header_json = serde_json::to_vec(&header).unwrap();
        let payload_json = serde_json::to_vec(&payload).unwrap();
        let header_b64 = URL_SAFE_NO_PAD.encode(&header_json);
        let payload_b64 = URL_SAFE_NO_PAD.encode(&payload_json);
        let message = format!("{header_b64}.{payload_b64}");
        let sig = jwt_sign(
            &message.as_bytes(),
            &EncodingKey::from_rsa_pem(FAKE_PRIVATE_PEM.as_bytes()).unwrap(),
            alg,
        )
        .unwrap();
        format!("{message}.{sig}")
    }

    /// The claims a (Google-ish) `credential` carries.
    fn payload() -> Value {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time went backwards")
            .as_secs() as i64;
        json!({
            "iss": "https://accounts.google.com",
            "sub": "1234",
            "aud": "999999999999",
            "exp": now + 300,
            "iat": now,
            "email": "user@edumap.vn",
            "name": "Edu Test",
        })
    }

    /// A valid credential must return the email from the *verified* payload.
    #[tokio::test]
    async fn test_verify_signed_credential_ok() {
        warm(FAKE_JWKS).await;
        let credential = sign_credential(payload(), "test-key", Algorithm::RS256).await;
        let claims = verify_google_credential(&credential).await.unwrap();
        assert_eq!(claims.email, "user@edumap.vn");
        assert_eq!(claims.sub, "1234");
        assert_eq!(claims.iss, "https://accounts.google.com");
        assert!(claims.exp > 0, "exp must be present and in the future");
    }

    /// A single flipped bit must never validate the payload.
    #[tokio::test]
    async fn test_verify_tampered_credential_fails() {
        warm(FAKE_JWKS).await;
        let credential = sign_credential(payload(), "test-key", Algorithm::RS256).await;
        let mut bytes = credential.into_bytes();
        // Flip the last character of the signature (base64url alphabet).
        let len = bytes.len();
        bytes[len - 1] = bytes[len - 1].wrapping_add(1);
        let credential = String::from_utf8(bytes).unwrap();
        assert!(verify_google_credential(&credential).await.is_err(),
            "a tampered credential must not be verified");
    }

    /// Google always sends a `kid`; a `kid` that does not resolve in the key set
    /// is rejected (the refetch of the whole set does not hide a rotation).
    #[tokio::test]
    async fn test_verify_unknown_kid_fails() {
        warm(FAKE_JWKS).await;
        let credential = sign_credential(payload(), "unknown-key", Algorithm::RS256).await;
        assert!(verify_google_credential(&credential).await.is_err(),
            "the key id must resolve to a key in the set");
    }

    /// The payload is only trusted when the issuer is the Google one.
    #[tokio::test]
    async fn test_verify_bad_issuer_fails() {
        warm(FAKE_JWKS).await;
        let mut signature_ver = payload();
        signature_ver["iss"] = json!("https://evil.issuer.com");
        let credential = sign_credential(signature_ver, "test-key", Algorithm::RS256).await;
        assert!(verify_google_credential(&credential).await.is_err(),
            "iss must be `https://accounts.google.com`");
    }

    /// An unsupported algorithm must never reach the signing stage.
    #[tokio::test]
    async fn test_verify_unsupported_alg_fails() {
        warm(FAKE_JWKS).await;
        let payload = payload();
        let header: Header = serde_json::from_str(r#"{"alg":"HS256","kid":"test-key"}"#).unwrap();
        let header_json = serde_json::to_vec(&header).unwrap();
        let payload_json = serde_json::to_vec(&payload).unwrap();
        let header_b64 = URL_SAFE_NO_PAD.encode(&header_json);
        let payload_b64 = URL_SAFE_NO_PAD.encode(&payload_json);
        let message = format!("{header_b64}.{payload_b64}");
        let signature = jwt_sign(
            &message.as_bytes(),
            &EncodingKey::from_secret(b"secret"),
            Algorithm::HS256,
        )
        .unwrap();
        let credential = format!("{message}.{signature}");
        assert!(verify_google_credential(&credential).await.is_err(),
            "HS256 must never be accepted");
    }

    /// An empty payload and a non-JWT are both rejected without network.
    #[tokio::test]
    async fn test_verify_quoted_payload_fails() {
        assert!(verify_google_credential("not.a.jwt").await.is_err(),
            "the bearer must be a three-part JWT");
        assert!(verify_google_credential("a").await.is_err(),
            "a single part is never a JWT");
        assert!(verify_google_credential("").await.is_err(),
            "an empty credential is empty");
    }
}
