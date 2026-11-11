import { authService } from './auth.service';

class SocketService {
    private controller: AbortController | null = null;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    connect() {
        if (this.controller || this.reader)
            return;
        this.addEventListener();
    }
    private addEventListener() {
        const token = authService.getAccessToken();
        if (!token)
            return;
        this.startStream(token);
    }
    private startStream(token: string) {
        this.controller = new AbortController();
        fetch('/api/notifications/subscribe', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'text/event-stream' },
            signal: this.controller.signal,
        })
        .then(async (response) => {
            if (!response.ok) {
                this.scheduleReconnect();
                return;
            }
            const body = response.body;
            if (!body) {
                this.scheduleReconnect();
                return;
            }
            this.reader = body.getReader();
            if (!this.reader) {
                this.scheduleReconnect();
                return;
            }
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) {
                    this.scheduleReconnect();
                    return;
                }
                const chunk = new TextDecoder().decode(value);
                // Parse SSE events: only the `data:` field of each message.
                const parts = chunk.split('\n');
                parts.forEach((part: string) => {
                    const text = part.trim();
                    if (!text)
                        return;
                    const m = text.match(/^data:(.*)$/);
                    if (!m)
                        return;
                    const data = m[1];
                    if (!data)
                        return;
                    let title = '', body = '';
                    try {
                        const payload = JSON.parse(data);
                        title = payload.title || '';
                        body = payload.body || '';
                    } catch {
                        title = data;
                    }
                    this.showToast(title, body);
                });
            }
        })
        .catch(() => {
            this.scheduleReconnect();
        });
    }
    private scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reader?.cancel();
            this.reader = null;
            this.addEventListener();
        }, 5000);
    }
    private showToast(title: string, body: string) {
        const event = new CustomEvent('edumap-notification', {
            detail: { title, body }
        });
        window.dispatchEvent(event);
    }
    disconnect() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
        if (this.reader) {
            this.reader.cancel();
            this.reader = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
export const socketService = new SocketService();
