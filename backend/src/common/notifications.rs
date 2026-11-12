/// In-process notification hub: a JSON server-sent events (SSE) stream with a
/// fan-out (broadcast) handler.
///
/// Replaces the old socket.io gateway (`modules/notifications/notification.gateway.ts` —
/// kept as reference only): the `realtime` namespace, `identity`, `notify` and the
/// `webrtc-*` events (join-call / webrtc-offer / webrtc-answer / ice-candidate) were
/// never wired into the frontend. The Rust backend exposes plain SSE instead:
///
/// - `GET /api/notifications/subscribe` — JWT authenticated, a `text/event-stream`
///   whose events are JSON payloads.
/// - the "create" endpoint (`POST /api/notifications/send`, module `notifications`)
///   broadcasts the stored row into the user's streams.
///
/// In-memory only. Subscribers are tracked by user id and dead streams (the receiver
/// is gone when the client disconnects) are pruned by the next broadcast. The
/// database remains the source of truth for past notifications (the frontend
/// resolves them with `GET /api/notifications`).
///
/// Modules push a notification with a single line:
///
/// ```rust,ignore
/// crate::common::notifications::hub().notify_user(&user_id, &payload).await;
/// ```

use crate::common::auth::authenticated_user;
use crate::common::error::AppError;
use crate::db::pool::DbPool;
use axum::extract::State;
use axum::body::Body;
use axum::http::Request<Body>;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, OnceCell};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::RwLock;

/// One channel of an SSE stream.
type SseChannel = mpsc::Sender<Event>;

/// Singleton hub installed by `init_hub()` in `main.rs` and created lazily by any
/// module firing a notification before the router is constructed.
pub static HUB: OnceCell<Arc<NotificationHub>> = OnceCell::new();

/// The hub (empty until `init_hub()` is called).
pub fn hub() -> Arc<NotificationHub> {
    HUB.get_or_init(|| Arc::new(NotificationHub::default())).clone()
}

/// Install the hub constructed in `main.rs`.
pub fn init_hub(hub: NotificationHub) {
    let _ = HUB.set(Arc::new(hub));
}

/// A notification payload pushed through the hub and stored in the `notifications` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub body: String,
    pub channel: String,
    pub sent_at: String,
    pub data: Option<Value>,
}

/// Fan-out hub: for every user id a list of subscriber channels.
#[derive(Default)]
pub struct NotificationHub {
    subscribers: RwLock<HashMap<String, Vec<SseChannel>>>,
}

impl NotificationHub {
    /// Register a channel for `user_id`; returns both halves of the pair so the
    /// caller can build the stream from the receiver.
    ///
    /// The channel is removed by the next `notify_user()` broadcast (a sender whose
    /// receiver is gone returns `Err`).
    pub async fn subscribe(&self, user_id: &str) -> (SseChannel, mpsc::Receiver<Event>) {
        let (tx, rx) = mpsc::channel(64);
        self.subscribers.write().await.entry(user_id.to_string()).or_default().push(tx);
        (tx, rx)
    }

    /// Unsubscribe from `user_id` (no-op if there is no stream).
    pub async fn unsubscribe(&self, user_id: &str) {
        self.subscribers.write().await.remove(user_id);
    }

    /// Push a payload into every subscribed stream of a user.
    pub async fn notify_user(&self, user_id: &str, payload: &Notification) {
        match Event::default().json_data(payload.clone()) {
            Ok(event) => {
                let mut subs = self.subscribers.write().await;
                if let Some(list) = subs.get_mut(user_id) {
                    list.retain(|tx| tx.send(event.clone()).is_ok());
                }
            }
            Err(_) => tracing::warn!("cannot serialize the notification event"),
        }
    }
}

/// `GET /api/notifications/subscribe` — an SSE stream of JSON events for the
/// logged-in user. The hub keeps the connection alive with a keep-alive event
/// every 20 s (defeats the reverse proxy timeouts).
pub async fn subscribe_sse(
    State(_pool): State<DbPool>,
    req: Request<Body>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    let user = authenticated_user(&req)?;

    let hub = hub();
    let (_tx, rx) = hub.subscribe(&user.id).await;

    tracing::trace!("subscribed: user_id={}", user.id);

    // Turn the `mpsc` receiver into a `Stream<Item = Result<Event, Infallible>>`.
    let stream = futures::stream::unfold(rx, |mut rx| async move {
        match rx.recv().await {
            Some(event) => Some((Ok::<_, Infallible>(event), rx)),
            None => None,
        }
    });

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::default().interval(Duration::from_secs(20)),
    ))
}
