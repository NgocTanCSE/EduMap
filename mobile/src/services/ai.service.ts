import apiService, { BASE_URL } from './api';

/**
 * AI chat service mirror of web FE.
 * Keeps a session history in memory and posts to /ai/chat.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
}

export const aiService = {
  history: [] as ChatMessage[],
  sessionId: null as string | null,

  /** Generate or reuse a session ID for this chat session.
   * Called on first render / first message of ChatScreen. */
  getSessionId(): string {
    if (!this.sessionId) {
      // UUID v4 fallback for React Native environments without crypto.randomUUID
      this.sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }
    return this.sessionId;
  },

  /** Reset the session (called when user starts a new chat). */
  /** Add a user message to the in-memory history (call before sending). */
  push(message: string) {
    this.history = [...this.history, { role: 'user', content: message }];
  },

  reset() {
    this.history = [];
    this.sessionId = null;
  },

  async getHistory() {
    return apiService.get('/ai/history');
  },

  /** Non-streaming fallback — kept for backward compatibility. */
  async sendMessage(message: string, context: string = 'mobile') {
    const res = await apiService.post('/ai/chat', {
      message,
      history: this.history,
      context: { source: context },
      session_id: this.getSessionId(),
    });
    const reply = res?.reply || res?.data?.reply || res?.message || '';
    if (reply) {
      this.history = [...this.history, { role: 'assistant', content: reply }];
    }
    return reply;
  },

  /**
   * Streaming chat: returns an async generator that yields SSE token chunks
   * in real-time. The caller receives each token as it arrives, enabling a
   * *typing effect* on the mobile UI (matching the web frontend).
   *
   * Falls back to non-streaming /ai/chat if the stream encounters an error,
   * so the user always gets a response.
   */
  async *sendMessageStream(
    message: string,
    history: any[] = [],
    context: string = 'mobile',
    onToken?: (token: string) => void,
    onSources?: (sources: any[]) => void,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 90000); // 90s for streaming

      const res = await fetch(`${BASE_URL}/ai/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiService.getToken() ? `Bearer ${apiService.getToken()}` : '',
        },
        body: JSON.stringify({
          message,
          history,
          context: { source: context },
          session_id: this.getSessionId(),
        }),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!res.ok) {
        // Fallback to non-streaming if stream endpoint fails
        const errData = await res.json().catch(() => null);
        const fallback = await this.sendMessage(message, context);
        yield fallback;
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      if (!reader) {
        throw new Error('No readable stream');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (Array.isArray(parsed.sources) && onSources) {
                onSources(parsed.sources);
              }
              if (typeof parsed.token === 'string') {
                onToken?.(parsed.token);
                yield parsed.token;
              }
              if (parsed.done) {
                return;
              }
            } catch {
              // Malformed SSE chunk — skip silently
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      console.warn('SSE stream failed, falling back to non-streaming:', error?.message);
      // Graceful fallback: switch to non-streaming /ai/chat
      const fallback = await this.sendMessage(message, context);
      if (fallback) {
        onToken?.(fallback);
        yield fallback;
      }
    }
  },

  async search(query: string, limit = 5) {
    return apiService.get('/ai/search', { q: query, limit });
  },

  async learningPath(payload: { goals: string; background?: string; interests?: string[] }) {
    return apiService.post('/ai/learning-path', payload);
  },

  async careerQuiz(answers: any) {
    return apiService.post('/ai/career-quiz', { answers });
  },

  async trends(subject?: string) {
    return apiService.get('/ai/trends', subject ? { subject } : undefined);
  },

  // ===================== OFFLINE TUTOR (Idea #7) =====================
  /**
   * Edge AI Tutor — ai-service text cascade (DeepSeek → Gemini → Cloudflare).
   * Falls back to template-based Vietnamese responses when no provider is
   * reachable.
   */
  offlineTutor: (payload: {
    action: 'explain' | 'practice' | 'suggest';
    topic: string;
    material_context?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    num_questions?: number;
    progression?: Record<string, any>;
  }) => apiService.post('/offline/tutor', payload),

  offlineTutorStatus: () => apiService.get('/offline/status'),
};

export default aiService;
