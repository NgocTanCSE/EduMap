import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * SessionMemoryService — in-memory, TTL-based chat session store.
 *
 * Mỗi phiên chat (session) theo dõi:
 *   - Tin nhắn gần đây (sliding window, tối đa 20 tin)
 *   - Chủ đề / từ khóa đã thảo luận (để đưa context SQL query-relevant)
 *   - Thời gian bắt đầu và hoạt động gần nhất (idle timeout cleanup)
 *
 * Trong môi trường HF Spaces (single container, DB_TYPE=sqlite),
 * Redis không khả dụng → dùng memory map với TTL tự động dọn dẹp.
 * Trên Docker Compose local (có Redis) service này vẫn hoạt động
 * vì chỉ là in-memory best-effort cache — persistent history vẫn
 * được lưu vào SQLite/Table chat_histories.
 */
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActive: Date;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  topics: string[];        // từ khóa chủ đề được trích từ conversation
  preferredContext: Record<string, any>;  // context preference (e.g. { location: 'Biên Hòa' })
}

@Injectable()
export class SessionMemoryService implements OnModuleInit {
  private readonly logger = new Logger(SessionMemoryService.name);
  private readonly sessions = new Map<string, ChatSession>();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;  // 30 min idle timeout
  private readonly MAX_MESSAGES = 20;                // sliding window
  private cleanupTimer: NodeJS.Timeout | null = null;

  ngOnModuleInit() {
    // Periodic cleanup: evict sessions idle longer than TTL
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let evicted = 0;
      for (const [sid, session] of this.sessions.entries()) {
        if (now - session.lastActive.getTime() > SESSION_TTL_MS) {
          this.sessions.delete(sid);
          evicted++;
        }
      }
      if (evicted > 0) {
        this.logger.log(`Evicted ${evicted} expired chat session(s)`);
      }
    }, 60_000);  // run every minute
    this.logger.log('SessionMemoryService initialized (TTL=30min, maxMsg=20)');
  }

  /**
   * Get or create a session for the given user.
   * If sessionId is provided and valid, return it; otherwise create a new one.
   */
  getOrCreateSession(userId: string, sessionId?: string): ChatSession {
    const now = new Date();

    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      // Ensure the session belongs to the same user (security check)
      if (session.userId === userId) {
        session.lastActive = now;
        return session;
      }
      // Session belongs to a different user — treat as expired
      this.sessions.delete(sessionId);
    }

    // Create new session ID
    const newSessionId = sessionId || this._generateSessionId();
    const session: ChatSession = {
      id: newSessionId,
      userId,
      createdAt: now,
      lastActive: now,
      messages: [],
      topics: [],
      preferredContext: {},
    };
    this.sessions.set(newSessionId, session);
    return session;
  }

  /**
   * Add a user message + assistant response to the session.
   * Extracts keywords from the user message to track conversation topics.
   */
  addTurn(sessionId: string, userMessage: string, assistantResponse: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const now = new Date();
    session.lastActive = now;

    session.messages.push(
      { role: 'user', content: userMessage, timestamp: now },
      { role: 'assistant', content: assistantResponse, timestamp: now },
    );

    // Sliding window: keep only the most recent MAX_MESSAGES
    if (session.messages.length > this.MAX_MESSAGES) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES);
    }

    // Extract topic keywords from the user message (simple heuristic:
    // words that appear in a whitelist of edu-related terms)
    this._extractTopics(session, userMessage);
  }

  /**
   * Get the recent message history for a session (for the LLM prompt).
   * Returns at most the last 10 messages as role/content pairs.
   */
  getRecentHistory(sessionId: string, maxMessages: number = 10): Array<{ role: string; content: string }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length === 0) return [];

    // Convert internal {role, content, timestamp} to {role, content}
    // and limit to the most recent maxMessages
    const recent = session.messages.slice(-maxMessages);
    return recent.map((m) => ({ role: m.role, content: m.content }));
  }

  /**
   * Get session-level context preferences (e.g. topics discussed, location).
   * Used by AIService._buildSystemContext() to make SQL context query-relevant
   * instead of always fetching the same top-N rows.
   */
  getSessionContext(sessionId: string): { topics: string[]; preferredContext: Record<string, any> } {
    const session = this.sessions.get(sessionId);
    if (!session) return { topics: [], preferredContext: {} };
    return {
      topics: [...session.topics],
      preferredContext: { ...session.preferredContext },
    };
  }

  /**
   * Close/end a session (called on chat reset or user logout).
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Generate a unique session ID (UUID v4 fallback for environments
   * without crypto.randomUUID).
   */
  private _generateSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  /**
   * Extract topic keywords from a user message using a simple heuristic.
   * EduMap domain keywords: trường, học bổng, mentor, ngành, lộ trình, etc.
   */
  private readonly _EDU_KEYWORDS = new Set([
    'học bổng', 'học bổng', 'trường', 'đại học', 'mentor', 'ngành',
    'lộ trình', 'kỹ năng', 'stem', 'wifi', 'thư viện', 'sách',
    'việc làm', 'công việc', 'kết quả', 'điểm số', 'gpa', 'kết quả học tập',
    'bản đồ', 'địa điểm', 'tuyểng thích', 'sở thích', 'chuyên ngành',
    'đào tạo', 'lớp', 'kì', 'học kỳ', 'thi', 'kỳ thi', 'chứng chỉ',
  ]);

  private _extractTopics(session: ChatSession, message: string): void {
    const lower = message.toLowerCase();
    const foundTopics: string[] = [];

    for (const kw of this._EDU_KEYWORDS) {
      if (lower.includes(kw) && !session.topics.includes(kw)) {
        foundTopics.push(kw);
      }
    }

    if (foundTopics.length > 0) {
      // Merge new topics, keep most recent 10
      session.topics = [...new Set([...session.topics, ...foundTopics])].slice(-10);
    }
  }
}
