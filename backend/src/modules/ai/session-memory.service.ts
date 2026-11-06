import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
export interface ChatSession {
    id: string;
    userId: string;
    createdAt: Date;
    lastActive: Date;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>;
    topics: string[];
    preferredContext: Record<string, any>;
}
@Injectable()
export class SessionMemoryService implements OnModuleInit {
    private readonly logger = new Logger(SessionMemoryService.name);
    private readonly sessions = new Map<string, ChatSession>();
    private readonly SESSION_TTL_MS = 30 * 60 * 1000;
    private readonly MAX_MESSAGES = 20;
    private cleanupTimer: NodeJS.Timeout | null = null;
    onModuleInit() {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            let evicted = 0;
            for (const [sid, session] of this.sessions.entries()) {
                if (now - session.lastActive.getTime() > this.SESSION_TTL_MS) {
                    this.sessions.delete(sid);
                    evicted++;
                }
            }
            if (evicted > 0) {
                this.logger.log(`Evicted ${evicted} expired chat session(s)`);
            }
        }, 60000);
        this.logger.log('SessionMemoryService initialized (TTL=30min, maxMsg=20)');
    }
    getOrCreateSession(userId: string, sessionId?: string): ChatSession {
        const now = new Date();
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            if (session.userId === userId) {
                session.lastActive = now;
                return session;
            }
            this.sessions.delete(sessionId);
        }
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
    addTurn(sessionId: string, userMessage: string, assistantResponse: string): void {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const now = new Date();
        session.lastActive = now;
        session.messages.push({ role: 'user', content: userMessage, timestamp: now }, { role: 'assistant', content: assistantResponse, timestamp: now });
        if (session.messages.length > this.MAX_MESSAGES) {
            session.messages = session.messages.slice(-this.MAX_MESSAGES);
        }
        this._extractTopics(session, userMessage);
    }
    getRecentHistory(sessionId: string, maxMessages: number = 10): Array<{
        role: string;
        content: string;
    }> {
        const session = this.sessions.get(sessionId);
        if (!session || session.messages.length === 0)
            return [];
        const recent = session.messages.slice(-maxMessages);
        return recent.map((m) => ({ role: m.role, content: m.content }));
    }
    getSessionContext(sessionId: string): {
        topics: string[];
        preferredContext: Record<string, any>;
    } {
        const session = this.sessions.get(sessionId);
        if (!session)
            return { topics: [], preferredContext: {} };
        return {
            topics: [...session.topics],
            preferredContext: { ...session.preferredContext },
        };
    }
    endSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }
    private _generateSessionId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }
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
            session.topics = [...new Set([...session.topics, ...foundTopics])].slice(-10);
        }
    }
}
