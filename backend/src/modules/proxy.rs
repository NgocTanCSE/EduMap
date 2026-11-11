//! Shared proxy helpers: forward requests into the FastAPI ai-service (port
//! 8000) and into the OSRM/ORS routing service (port 5000).
//!
//! The old NestJS backend forwarded these requests with `axios` (`responseType:
//! 'stream'` for SSE) and retried on `ECONNREFUSED` / timeout. This module
//! forwards (retrying on network failure) so the "Japan-proxy" endpoints —
//! geo analysis, climate, data gaps, survey, NL search, geo-vision, knowledge
//! graph, scheduling... — can all live in the backend without the ai-service
//! exposing them directly to the frontend.

use crate::common::error::AppError;
use axum::body::Body;
use axum::http::Response;
use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

/// Seconds a single request to the ai-service may spend (caps the
/// `reqwest::Client` timeout so it never outlives the NestJS 45s budget).
pub const AI_PROXY_TIMEOUT: u64 = 45;
/// Seconds a single request to the routing service may spend (OSRM graph
/// import on a cold start can take ~20 s).
pub const ROUTING_PROXY_TIMEOUT: u64 = 60;

/// A cache-safe request client (merged from the old `AiService` http client).
fn build_client(timeout: u64) -> Client {
    Client::builder()
        .timeout(Duration::from_secs(timeout))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .expect("build proxy request client")
}

/// Forward a JSON body into the ai-service (mirrors the old backend's
/// `proxyToAI`): post, retry on network failure (`ECONNREFUSED` / 503 /
/// timeout), return an `Internal` error when the loop is exhausted.
///
/// `path` is the endpoint path on the ai-service (e.g. `/api/ai/geo/analyze`;
/// the ai-service serves its methods under `/api/ai/` itself).
pub async fn proxy_to_ai_service(path: &str, body: Value) -> Result<Value, AppError> {
    let client = build_client(AI_PROXY_TIMEOUT);
    let target = format!("{}{}", crate::config::AI_SERVICE_URL.as_str(), path);
    let result = proxy_post_with_retries(&client, &target, body).await;
    result
}

/// Same, but a plain GET (naive set-and-forget proxy, no auth header).
pub async fn proxy_get_aiservice(path: &str) -> Result<Value, AppError> {
    let client = build_client(AI_PROXY_TIMEOUT);
    let target = format!("{}{}", crate::config::AI_SERVICE_URL.as_str(), path);
    proxy_get_with_retries(&client, &target).await
}

/// Forward a GET into the ai-service **keeping the status code** (largely for
/// the auto-scheduler, which answers `202 warming` while the scheduler runs).
/// Retries on network failure like the other helpers, then returns the
/// body without parsing it.
pub async fn proxy_get_aiservice_response(path: &str) -> Result<Response, AppError> {
    let client = build_client(AI_PROXY_TIMEOUT);
    let target = format!("{}{}", crate::config::AI_SERVICE_URL.as_str(), path);
    for attempt in 0..5 {
        match client
            .get(&target)
            .timeout(Duration::from_secs(AI_PROXY_TIMEOUT))
            .send()
            .await
        {
            Ok(response) => match response.status().is_success() {
                true => {
                    let bytes = response.bytes().await.map_err(AppError::from)?;
                    return Ok(Response::builder()
                        .status(response.status())
                        .body(Body::from(bytes))
                        .expect("build ai-service proxy response"));
                }
                false => {
                    if attempt + 1 >= 5 {
                        let text = response.text().await.unwrap_or_default();
                        return Err(AppError::Internal(format!(
                            "ai-service error {}: {}",
                            response.status(),
                            text
                        )));
                    }
                    tracing::warn!(
                        "ai-service returned {} (retry {}/5)",
                        response.status(),
                        attempt + 1
                    );
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    continue;
                }
            },
            Err(error) => {
                if attempt + 1 >= 5 || !is_retryable(&error) {
                    return Err(AppError::Io(error.to_string()));
                }
                tracing::warn!("ai-service request failed (retry {}/5)", attempt + 1);
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }
        }
    }
    Err(AppError::Io("ai-service request exhaustion".to_string()))
}

/// Proxy a GET request into the routing service (OSRM/ORS on port 5000).
pub async fn proxy_get_routing(path: &str) -> Result<Value, AppError> {
    let client = build_client(ROUTING_PROXY_TIMEOUT);
    let target = format!("{}{}", crate::config::ROUTING_SERVICE_URL.as_str(), path);
    proxy_get_with_retries(&client, &target).await
}

/// Proxy a JSON body into an arbitrary host (the `route_proxy` you wrote by
/// hand before; kept as-is for the odd one-out endpoints that need a raw
/// URL).
pub async fn proxy_to_host(url: &str, body: Value) -> Result<Value, AppError> {
    let client = build_client(AI_PROXY_TIMEOUT);
    for attempt in 0..5 {
        match client
            .post(url)
            .json(&body)
            .timeout(Duration::from_secs(AI_PROXY_TIMEOUT))
            .send()
            .await
        {
            Ok(response) => match response.status().is_success() {
                true => {
                    let data = response.json::<Value>().await.map_err(AppError::from)?;
                    return Ok(data);
                }
                false => {
                    if attempt + 1 >= 5 {
                        let text = response.text().await.unwrap_or_default();
                        return Err(AppError::Internal(format!(
                            "proxy error {}: {}",
                            response.status(),
                            text
                        )));
                    }
                    tracing::warn!(
                        "proxy returned {} (retry {}/5)",
                        response.status(),
                        attempt + 1
                    );
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    continue;
                }
            },
            Err(error) => {
                if attempt + 1 >= 5 || !is_retryable(&error) {
                    return Err(AppError::Io(error.to_string()));
                }
                tracing::warn!("proxy request failed (retry {}/5)", attempt + 1);
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }
        }
    }
    Err(AppError::Io("proxy request exhaustion".to_string()))
}

/// Retry logic for the POST branch (network failures only are retried).
async fn proxy_post_with_retries(
    client: &Client,
    target: &str,
    body: Value,
) -> Result<Value, AppError> {
    for attempt in 0..5 {
        match client
            .post(target)
            .json(&body)
            .timeout(Duration::from_secs(AI_PROXY_TIMEOUT))
            .send()
            .await
        {
            Ok(response) => match response.status().is_success() {
                true => return response.json::<Value>().await.map_err(AppError::from),
                false => {
                    if attempt + 1 >= 5 {
                        let text = response.text().await.unwrap_or_default();
                        return Err(AppError::Internal(format!(
                            "ai-service error {}: {}",
                            response.status(),
                            text
                        )));
                    }
                    tracing::warn!(
                        "ai-service returned {} (retry {}/5)",
                        response.status(),
                        attempt + 1
                    );
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    continue;
                }
            },
            Err(error) => {
                if attempt + 1 >= 5 || !is_retryable(&error) {
                    return Err(AppError::Io(error.to_string()));
                }
                tracing::warn!("ai-service request failed (retry {}/5)", attempt + 1);
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }
        }
    }
    Err(AppError::Io("ai-service request exhaustion".to_string()))
}

/// Retry logic for the GET branch (network failures only are retried).
async fn proxy_get_with_retries(client: &Client, target: &str) -> Result<Value, AppError> {
    for attempt in 0..5 {
        match client
            .get(target)
            .timeout(Duration::from_secs(AI_PROXY_TIMEOUT))
            .send()
            .await
        {
            Ok(response) => match response.status().is_success() {
                true => return response.json::<Value>().await.map_err(AppError::from),
                false => {
                    if attempt + 1 >= 5 {
                        let text = response.text().await.unwrap_or_default();
                        return Err(AppError::Internal(format!(
                            "error {}: {}",
                            response.status(),
                            text
                        )));
                    }
                    tracing::warn!("error {} (retry {}/5)", response.status(), attempt + 1);
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    continue;
                }
            },
            Err(error) => {
                if attempt + 1 >= 5 || !is_retryable(&error) {
                    return Err(AppError::Io(error.to_string()));
                }
                tracing::warn!("request failed (retry {}/5)", attempt + 1);
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }
        }
    }
    Err(AppError::Io("request exhaustion".to_string()))
}

/// Whether the request failed in a way worth trying again (connection
/// refused / DNS / timeout / 503), the same set the old backend retried.
fn is_retryable(error: &reqwest::Error) -> bool {
    error.is_timeout() || error.is_server_error() || error.is_connect()
}
