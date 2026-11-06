import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';
import { ChatHistory } from './entities/chat-history.entity';
import { QueryLog } from './entities/query-log.entity';
import { SessionMemoryService } from './session-memory.service';
import * as crypto from 'crypto';
@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private readonly aiServiceUrl: string;
    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService, 
    @InjectRepository(LearningMaterial)
    private readonly materialRepo: Repository<LearningMaterial>, 
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>, 
    @InjectRepository(ChatHistory)
    private readonly historyRepo: Repository<ChatHistory>, 
    @InjectRepository(QueryLog)
    private readonly queryLogsRepo: Repository<QueryLog>, private readonly sessionMemory: SessionMemoryService) {
        this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
    }
    triggerKnowledgeSync(): void {
        try {
            this.httpService
                .post(`${this.aiServiceUrl}/api/ai/sync-knowledge?background=true`, {}, { timeout: 5000 })
                .subscribe({
                next: () => this.logger.log('Triggered AI knowledge sync in background'),
                error: (err) => this.logger.warn(`Failed to trigger AI knowledge sync: ${err.message}`),
            });
        }
        catch (error: any) {
            this.logger.warn(`Failed to trigger AI knowledge sync: ${error.message}`);
        }
    }
    async embedDocument(docText: string, metadata: Record<string, any>, docId: string): Promise<void> {
        try {
            await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/embed`, { text: docText, metadata, id: docId }, { timeout: 15000 }));
            this.logger.log(`[Auto-Embed] Document '${docId}' embedded into vector DB.`);
        }
        catch (error: any) {
            this.logger.warn(`[Auto-Embed] Failed to embed '${docId}': ${error.message}`);
        }
    }
    async getUserHistory(userId: string) {
        try {
            return await this.historyRepo.find({
                where: { userId: userId },
                order: { createdAt: 'ASC' },
                take: 50,
            });
        }
        catch (error: any) {
            this.logger.error(`Error fetching chat history: ${error.message}`);
            return [];
        }
    }
    async search(query: string, limit: number = 5) {
        const normalizedQuery = `%${query.trim()}%`;
        const [materials, locations] = await Promise.all([
            this.materialRepo
                .createQueryBuilder('material')
                .select([
                'material.id',
                'material.title',
                'material.description',
                'material.type',
                'material.subject',
            ])
                .where('material.deleted_at IS NULL')
                .andWhere('(LOWER(material.title) LIKE LOWER(:query) OR LOWER(material.description) LIKE LOWER(:query))', { query: normalizedQuery })
                .orderBy('material.view_count', 'DESC')
                .take(limit)
                .getMany(),
            this.locationRepo
                .createQueryBuilder('location')
                .select(['location.id', 'location.name', 'location.description', 'location.address'])
                .where('LOWER(location.name) LIKE LOWER(:query) OR LOWER(location.description) LIKE LOWER(:query)', { query: normalizedQuery })
                .take(limit)
                .getMany(),
        ]);
        return {
            success: true,
            data: [
                ...materials.map((material) => ({
                    id: material.id,
                    document: `${material.title}: ${material.description || ''}`,
                    metadata: {
                        title: material.title,
                        type: 'learning_material',
                        category: material.subject || material.type,
                    },
                })),
                ...locations.map((location) => ({
                    id: location.id,
                    document: `${location.name}: ${location.description || ''}`,
                    metadata: {
                        title: location.name,
                        type: 'map_location',
                        address: location.address,
                    },
                })),
            ].slice(0, limit),
        };
    }
    async predictCareerPath(userData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend`, userData, {
                timeout: 60000,
            }));
            return response.data.top_careers || response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Career Recommend API: ${error.message}`);
            throw new HttpException('AI Career recommendation service is currently unavailable. Please ensure AI_SERVICE_URL is configured correctly.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async recommendCareerSemantic(skills: string[], interests: string[], experienceLevel: string, userId: string) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend-semantic`, {
                skills,
                interests: interests || [],
                experience_level: experienceLevel || 'beginner',
                user_id: userId,
            }, { timeout: 60000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Semantic Career Recommend unavailable: ${error.message}`);
            return null;
        }
    }
    async explainLearningSpace(spot: any, preferences: any): Promise<any | null> {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/learning-space/explain`, {
                spot,
                preferences,
            }, { timeout: 10000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Learning Space Explain unavailable: ${error.message}`);
            return null;
        }
    }
    private async _buildSystemContext(message: string, context: any): Promise<any> {
        const sessionContext = this.sessionMemory.getSessionContext(context?.session_id || '');
        const sessionTopics = sessionContext.topics;
        const msgLower = (message || '').toLowerCase();
        const searchTerms = [...sessionTopics, ...(message ? [message] : [])].join(' ').toLowerCase();
        let materials: any[] = [];
        let points: any[] = [];
        try {
            const normQuery = `%${(message || '').trim()}%`;
            const hasKeywordMatch = sessionTopics.length > 0 ||
                /hoc|bong|truong|ai|mentor|nganh|lộ trình|wifi|stem|thuvien|sach/i.test(msgLower);
            const [materialsResult, pointsResult] = await Promise.all([
                hasKeywordMatch
                    ? this.materialRepo
                        .createQueryBuilder('material')
                        .where('material.deleted_at IS NULL AND ' +
                        '(LOWER(material.title) LIKE LOWER(:q) OR LOWER(material.description) LIKE LOWER(:q))', { q: `%${searchTerms}%` })
                        .orderBy('material.view_count', 'DESC')
                        .take(5)
                        .getMany()
                    : this.materialRepo.find({ take: 5, order: { view_count: 'DESC' } }),
                hasKeywordMatch
                    ? this.locationRepo
                        .createQueryBuilder('location')
                        .leftJoinAndSelect('location.category', 'category')
                        .where('location.status = :status AND ' +
                        '(LOWER(location.name) LIKE LOWER(:q) OR LOWER(location.address) LIKE LOWER(:q))', { status: 'active', q: `%${searchTerms}%` })
                        .take(5)
                        .getMany()
                    : this.locationRepo.find({
                        take: 10,
                        where: { status: 'active' },
                        relations: ['category'],
                    }),
            ]);
            materials = materialsResult;
            points = pointsResult;
        }
        catch (dbError: any) {
            this.logger.error(`Database context error: ${dbError.message}`);
        }
        return {
            available_books: materials.map((m) => m.title),
            educational_locations: points.map((p) => `${p.name || 'Không rõ tên'} (${p.category?.display_name || 'Chưa phân loại'}) at ${p.address || 'Chưa có địa chỉ'}`),
            user_message: message,
            session_topics: sessionTopics,
            ...(context || {}),
        };
    }
    private _streamRetryConfig(): {
        attempts: number;
        delayMs: number;
    } {
        const attempts = Number(process.env.AI_STREAM_RETRY_ATTEMPTS ?? 3);
        const delayMs = Number(process.env.AI_STREAM_RETRY_DELAY_MS ?? 2000);
        return {
            attempts: Number.isFinite(attempts) && attempts >= 1 ? Math.floor(attempts) : 3,
            delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 2000,
        };
    }
    private _degradedStreamReply(message: string, reason: string, agent = false): string {
        const question = (message || '').trim();
        const shortQuestion = question.length > 140 ? `${question.slice(0, 140)}…` : question;
        const isColdStart = /ECONNREFUSED|ECONNRESET|EAI_AGAIN|socket hang up|connect /i.test(reason);
        const cause = isColdStart
            ? 'Máy chủ AI đang khởi động lại (Hugging Face free tier cần khoảng 30–60 giây sau mỗi lần nạp lại).'
            : 'Dịch vụ AI đang tạm thời quá tải.';
        if (agent) {
            return [
                `Xin lỗi, trợ lý bản đồ AI hiện chưa phản hồi được. ${cause}`,
                '',
                shortQuestion ? `Câu hỏi đã ghi nhận: "${shortQuestion}"` : '',
                'Bạn thử lại sau khoảng 1 phút. Trong lúc chờ, lớp dữ liệu trên bản đồ vẫn tra cứu được bình thường.',
            ]
                .filter(Boolean)
                .join('\n');
        }
        return [
            `Xin lỗi, trợ lý AI hiện chưa phản hồi được. ${cause}`,
            '',
            shortQuestion ? `Câu hỏi đã ghi nhận: "${shortQuestion}"` : '',
            'Bạn vui lòng thử lại sau khoảng 1 phút. Trong lúc chờ, bạn vẫn dùng được các mục: Bản đồ, Học bổng, Việc làm – Thực tập, Tài liệu học tập.',
        ]
            .filter(Boolean)
            .join('\n');
    }
    private _writeDegradedStream(res: any, reply: string, opts: {
        sources?: any[];
        userId?: string;
        message?: string;
        context?: any;
        sessionId?: string;
    } = {}): void {
        const { sources = [], userId, message, context, sessionId } = opts;
        try {
            if (typeof res.status === 'function')
                res.status(200);
            if (!res.headersSent) {
                res.setHeader?.('Content-Type', 'text/event-stream');
                res.setHeader?.('Cache-Control', 'no-cache');
                res.setHeader?.('Connection', 'keep-alive');
                res.setHeader?.('X-Accel-Buffering', 'no');
            }
            res.write(`data: ${JSON.stringify({ sources, meta: true })}\n\n`);
            const tokens = reply.match(/\S+\s*/g) || [reply];
            for (const token of tokens) {
                res.write(`data: ${JSON.stringify({ token, is_final: false })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ token: '', is_final: true, done: true })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
        catch (writeError: any) {
            this.logger.warn(`Unable to write degraded SSE reply: ${writeError?.message}`);
        }
        finally {
            try {
                res.end();
            }
            catch {
            }
        }
        if (userId && message && reply) {
            this.historyRepo
                .save(this.historyRepo.create({
                userId,
                message,
                response: reply,
                context: { ...(context || {}), sources, degraded: true, session_id: sessionId },
            }))
                .catch((saveError: any) => this.logger.error(`Error saving degraded chat history: ${saveError.message}`));
            if (sessionId)
                this.sessionMemory.addTurn(sessionId, message, reply);
        }
    }
    async chatStream(message: string, history: any[], ctx: any, userId: string, res: any, sessionId?: string) {
        let sourceStream: any;
        let systemContext: any = ctx || {};
        const sid = sessionId || (userId ? `sess_${userId}` : undefined);
        if (userId) {
            try {
                const session = this.sessionMemory.getOrCreateSession(userId, sid);
                if (!history || history.length === 0) {
                    history = this.sessionMemory.getRecentHistory(session.id, 6);
                }
                systemContext = { ...systemContext, session_id: session.id };
            }
            catch (e) {
                this.logger.warn(`Session memory error in chatStream: ${(e as any).message}`);
            }
        }
        try {
            systemContext = await this._buildSystemContext(message, systemContext);
        }
        catch (ctxError: any) {
            this.logger.warn(`Error building system context for chatStream: ${ctxError.message}`);
        }
        let lastError: any;
        let response: any;
        const streamPaths = ['/api/ai/chat/stream', '/chat/stream'];
        let pathIndex = 0;
        const { attempts: maxRetries, delayMs: retryDelayMs } = this._streamRetryConfig();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const streamPath = streamPaths[pathIndex];
            try {
                response = await this.httpService.axiosRef.post(`${this.aiServiceUrl}${streamPath}`, { message, history, context: systemContext, user_id: userId }, { responseType: 'stream', timeout: 10000 });
                sourceStream = response.data;
                break;
            }
            catch (error: any) {
                lastError = error;
                if (error.response?.status === 404 && pathIndex < streamPaths.length - 1) {
                    pathIndex += 1;
                    this.logger.warn(`AI stream path ${streamPath} returned 404 — retrying with ${streamPaths[pathIndex]}`);
                    attempt -= 1;
                    continue;
                }
                const isConnRefused = error.code === 'ECONNREFUSED' ||
                    error.code === 'ECONNRESET' ||
                    (error.message &&
                        (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
                const isServiceUnavailable = error.response && error.response.status === 503;
                const isRetryable = isConnRefused || isServiceUnavailable;
                if (attempt < maxRetries && isRetryable) {
                    this.logger.warn(`AI service not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelayMs}ms...`);
                    await new Promise((r) => setTimeout(r, retryDelayMs));
                    continue;
                }
                const detail = lastError.response?.data?.detail ||
                    lastError.response?.data?.message ||
                    lastError.message ||
                    'Connection refused — ai-service may be restarting.';
                this.logger.warn(`AI streaming unavailable after ${maxRetries} attempt(s) — sending degraded reply: ${detail}`);
                if (!res.headersSent) {
                    this._writeDegradedStream(res, this._degradedStreamReply(message, String(detail)), {
                        sources: [],
                        userId,
                        message,
                        context: systemContext,
                        sessionId: sid,
                    });
                }
                else {
                    try {
                        res.end();
                    }
                    catch {
                    }
                }
                return;
            }
        }
        let fullReply = '';
        let sources: any[] = [];
        let buffer = '';
        const saveToHistory = () => {
            if (!userId || !fullReply)
                return;
            this.historyRepo
                .save(this.historyRepo.create({
                userId: userId,
                message: message,
                response: fullReply,
                context: { ...systemContext, sources },
            }))
                .catch((saveError: any) => this.logger.error(`Error saving streaming chat history: ${saveError.message}`));
            this._logQuery(userId, message, sources, fullReply);
            if (userId && sid) {
                this.sessionMemory.addTurn(sid, message, fullReply);
            }
        };
        const safeEnd = () => {
            try {
                res.end();
            }
            catch {
            }
        };
        res.on('close', () => {
            if (sourceStream && !sourceStream.destroyed) {
                sourceStream.destroy();
            }
        });
        sourceStream.on('data', (chunk: Buffer | string) => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
            res.write(text);
            buffer += text;
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const event of events) {
                const line = event.trim();
                if (!line.startsWith('data: '))
                    continue;
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]')
                    continue;
                try {
                    const parsed = JSON.parse(dataStr);
                    if (Array.isArray(parsed.sources))
                        sources = parsed.sources;
                    if (typeof parsed.token === 'string')
                        fullReply += parsed.token;
                }
                catch {
                }
            }
        });
        sourceStream.on('end', () => {
            safeEnd();
            saveToHistory();
        });
        sourceStream.on('error', (err: any) => {
            this.logger.warn(`SSE stream error from ai-service: ${err.message}`);
            safeEnd();
        });
    }
    async agentChat(message: string, history: any[], ctx: any, userId?: string, sessionId?: string) {
        const sid = sessionId || (userId ? `sess_${userId}` : undefined);
        let systemContext = { ...(ctx || {}), session_id: sid };
        try {
            systemContext = await this._buildSystemContext(message, systemContext);
        }
        catch (ctxError: any) {
            this.logger.warn(`Error building system context for agentChat: ${ctxError.message}`);
        }
        const payload: any = {
            message,
            history,
            context: systemContext,
            session_id: sid,
        };
        if (userId)
            payload.user_id = userId;
        let lastError: any;
        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/agent/chat`, payload, {
                    timeout: 30000,
                }));
                return response.data;
            }
            catch (error: any) {
                lastError = error;
                const isConnRefused = error.code === 'ECONNREFUSED' ||
                    error.code === 'ECONNRESET' ||
                    (error.message && error.message.includes('ECONNREFUSED'));
                const isServiceUnavailable = error.response && error.response.status === 503;
                const isRetryable = isConnRefused || isServiceUnavailable;
                if (attempt < maxRetries && isRetryable) {
                    this.logger.warn(`AI agent service not ready (attempt ${attempt}/${maxRetries}), retrying in 3s...`);
                    await new Promise((r) => setTimeout(r, 3000));
                    continue;
                }
                const status = error?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
                const detail = error?.response?.data?.detail ||
                    error?.response?.data?.message ||
                    error?.message ||
                    'AI agent service is currently unavailable.';
                if (isConnRefused) {
                    this.logger.warn('AI Agent service unreachable — returning local fallback');
                    return {
                        answer: 'Xin lỗi, trợ lý bản đồ AI hiện chưa phản hồi được. Máy chủ AI đang khởi động lại. Bạn thử lại sau 1 phút nhé.',
                        sources: [],
                        degraded: true,
                        reason: 'ai-service unreachable (cold start)',
                    };
                }
                throw new HttpException(detail, status);
            }
        }
        throw new HttpException(lastError?.response?.data?.detail || 'AI agent service unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    async agentChatStream(message: string, history: any[], ctx: any, userId: string, res: any, sessionId?: string) {
        const sid = sessionId || (userId ? `sess_${userId}` : undefined);
        let systemContext = { ...(ctx || {}), session_id: sid };
        if (userId) {
            try {
                const session = this.sessionMemory.getOrCreateSession(userId, sid);
                if (!history || history.length === 0) {
                    history = this.sessionMemory.getRecentHistory(session.id, 6);
                }
                systemContext = { ...systemContext, session_id: session.id };
            }
            catch (e) {
                this.logger.warn(`Session memory error in agentChatStream: ${(e as any).message}`);
            }
        }
        try {
            systemContext = await this._buildSystemContext(message, systemContext);
        }
        catch (ctxError: any) {
            this.logger.warn(`Error building system context for agentChatStream: ${ctxError.message}`);
        }
        const payload: any = {
            message,
            history,
            context: systemContext,
            session_id: sid,
        };
        if (userId)
            payload.user_id = userId;
        let response: any;
        let lastError: any;
        const { attempts: maxRetries, delayMs: retryDelayMs } = this._streamRetryConfig();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                response = await this.httpService.axiosRef.post(`${this.aiServiceUrl}/api/ai/agent/chat-stream`, payload, { responseType: 'stream', timeout: 10000 });
                break;
            }
            catch (error: any) {
                lastError = error;
                const isConnRefused = error.code === 'ECONNREFUSED' ||
                    error.code === 'ECONNRESET' ||
                    (error.message &&
                        (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
                const isServiceUnavailable = error.response && error.response.status === 503;
                const isRetryable = isConnRefused || isServiceUnavailable;
                if (attempt < maxRetries && isRetryable) {
                    this.logger.warn(`AI agent streaming not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelayMs}ms...`);
                    await new Promise((r) => setTimeout(r, retryDelayMs));
                    continue;
                }
                const detail = lastError.response?.data?.detail ||
                    lastError.response?.data?.message ||
                    lastError.message ||
                    'AI agent streaming service is currently unavailable.';
                this.logger.warn(`AI agent streaming unavailable after ${maxRetries} attempt(s) — sending degraded reply: ${detail}`);
                if (!res.headersSent) {
                    this._writeDegradedStream(res, this._degradedStreamReply(message, String(detail), true), { sources: [], userId, message, context: systemContext, sessionId: sid });
                }
                else {
                    try {
                        res.end();
                    }
                    catch {
                    }
                }
                return;
            }
        }
        const sourceStream = response.data;
        let buffer = '';
        let fullReply = '';
        let sources: any[] = [];
        const saveToHistory = () => {
            if (!userId || !fullReply)
                return;
            this.historyRepo
                .save(this.historyRepo.create({
                userId: userId,
                message: message,
                response: fullReply,
                context: { ...systemContext, sources, session_id: sid },
            }))
                .catch((saveError: any) => this.logger.error(`Error saving streaming agent chat history: ${saveError.message}`));
            if (userId && sid) {
                this.sessionMemory.addTurn(sid, message, fullReply);
            }
        };
        const safeEnd = () => {
            try {
                res.end();
            }
            catch {
            }
        };
        res.on('close', () => {
            if (sourceStream && !sourceStream.destroyed) {
                sourceStream.destroy();
            }
        });
        sourceStream.on('data', (chunk: Buffer | string) => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
            res.write(text);
            buffer += text;
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const event of events) {
                const line = event.trim();
                if (!line.startsWith('data: '))
                    continue;
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]')
                    continue;
                try {
                    const parsed = JSON.parse(dataStr);
                    if (Array.isArray(parsed.sources))
                        sources = parsed.sources;
                    if (typeof parsed.token === 'string')
                        fullReply += parsed.token;
                }
                catch {
                }
            }
        });
        sourceStream.on('end', () => {
            safeEnd();
            saveToHistory();
        });
        sourceStream.on('error', (err: any) => {
            this.logger.warn(`SSE stream error from ai-agent service: ${err.message}`);
            safeEnd();
        });
    }
    async getMarketTrends() {
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/trends`, { timeout: 20000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Trends API: ${error.message}`);
            const isConnRefused = error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                (error.message &&
                    (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
            if (isConnRefused) {
                this.logger.warn('AI Trends service unreachable — returning empty trends');
                return { success: true, data: { trends: [], degraded: true, reason: 'ai-service unreachable' } };
            }
            throw new HttpException('AI Market trends service is currently unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async dataQualityReport(params?: {
        category?: string;
        limit?: number;
        include_clean?: boolean;
    }) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/data/quality/report`, params || {}, {
                timeout: 30000,
            }));
            return response.data;
        }
        catch (error: any) {
            const detail = error?.response?.data?.detail ||
                error?.message ||
                'AI Data Quality service is currently unavailable.';
            this.logger.error(`Error calling AI Data Quality API: ${detail}`);
            const isConnRefused = error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                (error.message &&
                    (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
            if (isConnRefused) {
                this.logger.warn('AI Data Quality service unreachable — returning empty report');
                return { success: true, data: { anomalies: [], degraded: true, reason: 'ai-service unreachable' } };
            }
            throw new HttpException('Dịch vụ phân tích chất lượng dữ liệu AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async getDailyInsight(dashboardData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/analytics/daily-insight`, {
                dashboard_data: dashboardData,
            }, { timeout: 60000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Daily Insight unavailable, using local fallback: ${error.message}`);
            return null;
        }
    }
    async analyzeGeoDensity(geoData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, geoData, {
                timeout: 45000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Geo-Analyze API: ${error.message}`);
            throw new HttpException('Dịch vụ phân tích địa lý AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async summarizeMaterial(materialData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/library/summarize`, materialData, {
                timeout: 60000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Library Summarize API: ${error.message}`);
            throw new HttpException('Dịch vụ tóm tắt AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async generateLearningPath(data: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/learning-path/`, data, {
                timeout: 60000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Learning Path API: ${error.message}`);
            throw new HttpException('Dịch vụ tạo lộ trình học tập AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async matchMentor(matchData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/mentor/match`, matchData, {
                timeout: 45000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Mentor Match API: ${error.message}`);
            throw new HttpException('Dịch vụ ghép nối AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async impactMatchRank(rankData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/impactmatch/rank`, rankData, {
                timeout: 45000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI ImpactMatch Rank API: ${error.message}`);
            throw new HttpException('Dịch vụ ghép nối AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async measureImpact(data: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/impact/measure`, data, {
                timeout: 30000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Impact Measure unavailable (will degrade): ${error.message}`);
            return null;
        }
    }
    async speechToText(payload: {
        audio_base64: string;
        audio_format?: string;
        language?: string;
    }): Promise<any> {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/speech/to-text`, payload, {
                timeout: 30000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Speech-to-Text fallback unavailable: ${error.message}`);
            return {
                text: '',
                language: payload.language || 'vi',
                method: 'fallback',
                confidence: null,
                degraded: true,
                error: 'AI service unavailable — please rely on client-side speech recognition',
            };
        }
    }
    async resourceExchangeMatchRank(rankData: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/resource-exchange/match-rank`, rankData, { timeout: 45000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI ResourceExchange MatchRank API: ${error.message}`);
            throw new HttpException('Dịch vụ ghép nối nguồn lực AI đang tạm thời gián đoạn.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async moderateContent(userId: string, text: string) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/moderate/`, {
                user_id: userId,
                text: text,
            }, { timeout: 15000 }));
            return response.data;
        }
        catch (error: any) {
            const detail = error?.response?.data?.detail ||
                error?.message ||
                'AI Content moderation service is currently unavailable.';
            this.logger.error(`Error calling AI Moderation API: ${detail}`);
            const isConnRefused = error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                (error.message &&
                    (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
            if (isConnRefused) {
                this.logger.warn('AI Moderation service unreachable — returning local fallback (allow)');
                return { allowed: true, categories: [], degraded: true, reason: 'ai-service unreachable' };
            }
            throw new HttpException(detail, HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async getCachedResourceExchangeMatches(refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/resource-exchange/matches?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler resource-exchange proxy failed: ${error.message}`);
            return {
                task: "resource_exchange",
                status: "unavailable",
                degraded: true,
                reason: "AI service unavailable — chưa có kết quả cache.",
                ranked_matches: [],
                transport_plan: [],
            };
        }
    }
    async getCachedImpactMatchRankings(refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/impact-match/rankings?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler impact-match proxy failed: ${error.message}`);
            return {
                task: "impact_match",
                status: "unavailable",
                degraded: true,
                reason: "AI service unavailable — chưa có kết quả cache.",
                ranked_matches: [],
            };
        }
    }
    async getCachedImpactMeasure(regionId: string, refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/impact-measurement/${regionId}?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler impact-measurement proxy failed: ${error.message}`);
            return {
                task: "impact_measure",
                status: "unavailable",
                degraded: true,
                reason: `AI service unavailable — chưa có kết quả cache cho ${regionId}.`,
            };
        }
    }
    async getCachedClimateRisk(regionId: string, refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/climate-risk/${regionId}?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler climate-risk proxy failed: ${error.message}`);
            return {
                task: "climate_risk",
                status: "unavailable",
                degraded: true,
                reason: `AI service unavailable — chưa có kết quả cache cho ${regionId}.`,
            };
        }
    }
    async getCachedQuestionGaps(refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/question-gaps?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler question-gaps proxy failed: ${error.message}`);
            return {
                task: "question_gaps",
                status: "unavailable",
                degraded: true,
                reason: "AI service unavailable — chưa có báo cáo cache.",
            };
        }
    }
    async getCachedDailyInsight(refresh?: boolean): Promise<any> {
        try {
            const params = new URLSearchParams();
            if (refresh)
                params.set("refresh", "true");
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/daily-insight?${params.toString()}`, { timeout: 8000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler daily-insight proxy failed: ${error.message}`);
            return {
                task: "daily_insight",
                status: "unavailable",
                degraded: true,
                reason: "AI service unavailable — chưa có gợi ý cache.",
                motivation_message: "Hãy khám phá tài nguyên giáo dục mới trên EduMap.",
                suggested_action: "Xem thư viện hoặc bản đồ địa điểm gần bạn.",
            };
        }
    }
    async getAutoRegions(): Promise<any> {
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/regions`, { timeout: 5000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Auto-scheduler regions proxy failed: ${error.message}`);
            return { regions: [], degraded: true };
        }
    }
    async getAutoSchedulerHealth(): Promise<any> {
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/auto/health`, { timeout: 5000 }));
            return response.data;
        }
        catch (error: any) {
            return {
                scheduler_enabled: false,
                running: false,
                error: "AI service unavailable",
                degraded: true,
            };
        }
    }
    async checkScholarshipEligibility(userData: any, scholarshipData: any, transcriptData?: any) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/scholarship/check`, {
                user_data: userData,
                scholarship_data: scholarshipData,
                transcript_data: transcriptData,
            }, { timeout: 45000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Scholarship Check API: ${error.message}`);
            const isConnRefused = error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                (error.message &&
                    (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
            if (isConnRefused) {
                this.logger.warn('AI Scholarship service unreachable — returning local fallback evaluation');
                return this._localScholarshipFallback(userData, scholarshipData, transcriptData);
            }
            throw new HttpException('AI Scholarship eligibility service is currently unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    private _localScholarshipFallback(userData: any, scholarshipData: any, transcriptData?: any): any {
        const requirements = (scholarshipData?.requirements ||
            scholarshipData?.eligibility_criteria ||
            scholarshipData?.criteria ||
            '').toString();
        const userProfile = {
            major: userData?.major || userData?.field_of_study || '',
            gpa: transcriptData?.gpa || userData?.gpa,
            language_scores: transcriptData?.language_scores || userData?.language_scores,
            experience_years: userData?.experience_years || userData?.work_experience,
        };
        let gpaMin: number | null = null;
        const gpaMatch = requirements.match(/(?:gpa|điểm\s*trung\s*bình|xếp\s*loại)\s*[:\/]?\s*([<>]=?\s*\d+[.,]?\d*|\d+[.,]?\d*)/i);
        if (gpaMatch) {
            const raw = gpaMatch[1].replace(',', '.').replace(/[<>]=?\s*/g, '');
            const val = parseFloat(raw);
            if (!isNaN(val)) {
                gpaMin = val <= 10 ? val : val / 25;
            }
        }
        let eligible = true;
        const reasons: string[] = [];
        if (gpaMin !== null && userProfile.gpa !== undefined && userProfile.gpa !== null) {
            const u = parseFloat(String(userProfile.gpa).replace(',', '.'));
            if (!isNaN(u) && u < gpaMin) {
                eligible = false;
                reasons.push(`GPA ${u} < yêu cầu ${gpaMin}`);
            }
        }
        if (userProfile.major && requirements) {
            const reqLower = requirements.toLowerCase();
            const majorLower = userProfile.major.toLowerCase();
            if (reqLower.includes('khoa') || reqLower.includes('ngành') || reqLower.includes('chuyên')) {
            }
        }
        const langMatch = requirements.match(/(?:ielts|toefl|toeic)\s*[:\/]?\s*(\d+[.,]?\d*)/i);
        if (langMatch) {
            const required = parseFloat(langMatch[1].replace(',', '.'));
            if (!isNaN(required)) {
                const userScore = userProfile.language_scores
                    ? Math.max(...Object.values(userProfile.language_scores)
                        .map((v) => parseFloat(String(v).replace(',', '.')))
                        .filter((v) => !isNaN(v)))
                    : null;
                if (userScore !== null && userScore < required) {
                    eligible = false;
                    reasons.push(`Điểm ngoại ngữ ${userScore} < yêu cầu ${required}`);
                }
            }
        }
        return {
            eligible,
            score: eligible ? 85 : 40,
            reasons: reasons.length ? reasons : ['Đánh giá tự động (chế độ offline)'],
            analysis: [
                `Đánh giá tự động (AI service chưa sẵn sàng — dùng quy tắc cục bộ) cho học bổng '${scholarshipData?.title || 'Không tên'}'`,
                `Yêu cầu: ${requirements || 'Không có yêu cầu chi tiết'}`,
                transcriptData?.gpa ? `GPA từ bảng điểm: ${transcriptData.gpa}` : '',
                userProfile.gpa ? `GPA hồ sơ: ${userProfile.gpa}` : '',
            ].filter(Boolean).join('\n'),
            meta: { degraded: true, reason: 'ai-service unreachable (cold start)' },
        };
    }
    private _localChatFallback(message: string, context: any): {
        reply: string;
        sources: any[];
    } {
        const question = (message || '').trim();
        const shortQuestion = question.length > 140 ? `${question.slice(0, 140)}…` : question;
        const reply = [
            'Xin lỗi, trợ lý AI hiện chưa phản hồi được. Máy chủ AI đang khởi động lại (Hugging Face free tier cần khoảng 30–60 giây sau mỗi lần nạp lại).',
            '',
            shortQuestion ? `Câu hỏi đã ghi nhận: "${shortQuestion}"` : '',
            'Bạn vui lòng thử lại sau khoảng 1 phút. Trong lúc chờ, bạn vẫn dùng được các mục: Bản đồ, Học bổng, Việc làm – Thực tập, Tài liệu học tập.',
        ]
            .filter(Boolean)
            .join('\n');
        return {
            reply,
            sources: [],
        };
    }
    async matchOpportunities(data: {
        user_profile: any;
        opportunities: any[];
    }) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/opportunity/match`, data, {
                timeout: 45000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`Error calling AI Opportunity Match API: ${error.message}`);
            const isConnRefused = error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                (error.message &&
                    (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
            if (isConnRefused) {
                this.logger.warn('AI Opportunity Match service unreachable — returning empty matches');
                return { success: true, data: { matches: [], degraded: true, reason: 'ai-service unreachable' } };
            }
            throw new HttpException('AI Opportunity Radar service is currently unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async getAnalyticsStats() {
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/analytics/stats`, { timeout: 15000 }));
            const data = response.data || {};
            const historicalData = Array.isArray(data.historical_data) ? data.historical_data : [];
            const insights = data.insights || {};
            const lastValue = historicalData.length > 0
                ? Number(historicalData[historicalData.length - 1].value ||
                    historicalData[historicalData.length - 1].metric_value ||
                    0)
                : 0;
            const accuracyRate = insights.average_annual_growth_pct
                ? Math.min(0.99, 0.75 + Math.abs(Number(insights.average_annual_growth_pct)) / 100)
                : 0.9;
            let totalPredictions = 0;
            try {
                totalPredictions = await this.historyRepo.count();
            }
            catch (countError: any) {
                this.logger.warn(`Could not count chat history for analytics: ${countError.message}`);
            }
            return {
                success: true,
                data: {
                    total_predictions: totalPredictions,
                    accuracy_rate: Number(accuracyRate.toFixed(2)),
                    active_models: 2,
                    status: data.status || 'success',
                    historical_data: historicalData,
                    sectors: Array.isArray(data.sectors) ? data.sectors : [],
                    trending_skills: Array.isArray(data.trending_skills) ? data.trending_skills : [],
                    trending_skills_source: data.trending_skills_source || 'local',
                    insights,
                    last_value: lastValue,
                },
            };
        }
        catch (error: any) {
            this.logger.error(`Error fetching AI analytics stats: ${error.message}`);
            throw new HttpException('AI Analytics stats service is currently unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async chat(message: string, history: any[], context: any, userId?: string, sessionId?: string) {
        const sid = sessionId || (userId ? `sess_${userId}` : undefined);
        if (userId) {
            const session = this.sessionMemory.getOrCreateSession(userId, sid);
            if (!history || history.length === 0) {
                history = this.sessionMemory.getRecentHistory(session.id, 6);
            }
            context = { ...(context || {}), session_id: session.id };
        }
        const systemContext = await this._buildSystemContext(message, context);
        let lastError: any;
        let response: any;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/chat`, {
                    user_id: userId,
                    message: message,
                    history: history,
                    context: systemContext,
                }, { timeout: 60000 }));
                break;
            }
            catch (error: any) {
                lastError = error;
                const isConnRefused = error.code === 'ECONNREFUSED' ||
                    error.code === 'ECONNRESET' ||
                    (error.message &&
                        (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN'))) ||
                    (error.message && error.message.includes('ETIMEDOUT'));
                const isServiceUnavailable = error.response && error.response.status === 503;
                const isRetryable = isConnRefused || isServiceUnavailable;
                if (attempt < maxRetries && isRetryable) {
                    this.logger.warn(`AI chat service not ready (attempt ${attempt}/${maxRetries}), retrying in 2s...`);
                    await new Promise((r) => setTimeout(r, 2000));
                    continue;
                }
                const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message;
                if (isConnRefused) {
                    this.logger.warn('AI Chat service unreachable — returning local fallback reply');
                    const fallback = this._localChatFallback(message, systemContext);
                    if (userId) {
                        try {
                            const newChat = this.historyRepo.create({
                                userId: userId,
                                message: message,
                                response: fallback.reply,
                                context: { ...systemContext, sources: [], degraded: true },
                            });
                            await this.historyRepo.save(newChat);
                        }
                        catch (saveError: any) {
                            this.logger.error(`Error saving fallback chat history: ${saveError.message}`);
                        }
                        if (sid)
                            this.sessionMemory.addTurn(sid, message, fallback.reply);
                    }
                    return fallback;
                }
                const status = error?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
                this.logger.error(`Error in AI Chat [status ${status}]: ${detail}`);
                throw new HttpException(detail, status);
            }
        }
        const aiReply = response.data.reply || response.data.message;
        const sources = response.data.sources || [];
        if (userId) {
            try {
                const newChat = this.historyRepo.create({
                    userId: userId,
                    message: message,
                    response: aiReply,
                    context: systemContext,
                });
                await this.historyRepo.save(newChat);
            }
            catch (saveError: any) {
                this.logger.error(`Error saving chat history: ${saveError.message}`);
            }
        }
        this._logQuery(userId, message, sources, aiReply);
        if (userId && sid) {
            this.sessionMemory.addTurn(sid, message, aiReply);
        }
        return response.data;
    }
    async getKnowledgeGraph(nodeTypes?: string[], limit = 500) {
        const params = new URLSearchParams();
        if (nodeTypes && nodeTypes.length)
            params.set('node_types', nodeTypes.join(','));
        params.set('limit', String(limit));
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/knowledge/graph?${params.toString()}`, {
                timeout: 15000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`AI Knowledge Graph proxy failed: ${error.message}`);
            return { nodes: [], edges: [], meta: {}, degraded: true, reason: error.message };
        }
    }
    async queryKnowledgeGraph(nodeId: string, edgeTypes?: string[], depth = 1, limit = 50) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/knowledge/query`, {
                node_id: nodeId,
                edge_types: edgeTypes,
                depth,
                limit,
            }, { timeout: 15000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Knowledge Graph query proxy failed: ${error.message}`);
            return {
                start_node: null,
                neighbors: [],
                edges: [],
                meta: { degraded: true, reason: error.message },
            };
        }
    }
    async suggestKnowledgePartners(query: string, limit = 10, focusType?: string) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/knowledge/suggest-partners`, {
                query,
                limit,
                focus_type: focusType,
            }, { timeout: 15000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Knowledge Graph suggest-partners proxy failed: ${error.message}`);
            return { query, count: 0, suggestions: [], degraded: true, reason: error.message };
        }
    }
    private _hashUserId(userId: string): string {
        return crypto.createHash('sha256').update(String(userId)).digest('hex');
    }
    private _computeQuality(sources: any[], reply: string): number {
        const sourceCount = Array.isArray(sources) ? sources.length : 0;
        const replyLen = reply ? reply.length : 0;
        const retrievalScore = Math.min(1.0, sourceCount / 5);
        const replyScore = Math.min(1.0, replyLen / 500);
        return Number((retrievalScore * 0.6 + replyScore * 0.4).toFixed(3));
    }
    private _retrievalStatus(sources: any[]): string {
        const count = Array.isArray(sources) ? sources.length : 0;
        if (count >= 3)
            return 'success';
        if (count > 0)
            return 'partial';
        return 'failed';
    }
    private _logQuery(userId: string, message: string, sources: any[], reply: string): void {
        if (!userId)
            return;
        try {
            const userHash = this._hashUserId(userId);
            const retrievalStatus = this._retrievalStatus(sources);
            const quality = this._computeQuality(sources, reply);
            const responseText = reply ? reply.slice(0, 2000) : null;
            this.queryLogsRepo
                .save(this.queryLogsRepo.create({
                userIdHash: userHash,
                queryText: message,
                retrievedDocCount: Array.isArray(sources) ? sources.length : 0,
                retrievalStatus,
                responseText,
                responseQuality: quality,
            }))
                .catch((err: any) => this.logger.error(`Error saving query log: ${err.message}`));
        }
        catch (err: any) {
            this.logger.debug(`Query log skipped: ${err.message}`);
        }
    }
    private readonly QUESTION_GAPS_CACHE_MAX = 50;
    private readonly QUESTION_GAPS_CACHE_TTL_MS = 30 * 60 * 1000;
    private _questionGapsCache: Map<string, {
        data: any;
        expires: number;
    }> = new Map();
    async getQuestionGaps(limit?: number): Promise<any> {
        const cacheKey = `qg:${limit || 'auto'}`;
        if (limit === undefined || limit >= 10000) {
            try {
                const autoResult = await this.getCachedQuestionGaps();
                if (autoResult && !autoResult.degraded && autoResult.task === "question_gaps" &&
                    (autoResult.total_queries !== undefined || autoResult.clusters !== undefined)) {
                    return { ...autoResult, source: "auto_scheduler" };
                }
            }
            catch {
            }
        }
        const cacheKeyQ = `qg:${limit || 0}`;
        const now = Date.now();
        const cached = this._questionGapsCache.get(cacheKeyQ);
        if (cached && cached.expires > now) {
            return { ...cached.data, cached: true };
        }
        if (cached)
            this._questionGapsCache.delete(cacheKeyQ);
        try {
            const params = new URLSearchParams();
            if (limit)
                params.set("limit", String(limit));
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/ai/analytics/question-gaps?${params.toString()}`, { timeout: 30000 }));
            const result = response.data || {};
            if (this._questionGapsCache.size >= this.QUESTION_GAPS_CACHE_MAX) {
                const oldestKey = this._questionGapsCache.keys().next().value;
                if (oldestKey)
                    this._questionGapsCache.delete(oldestKey);
            }
            this._questionGapsCache.set(cacheKey, {
                data: result,
                expires: now + this.QUESTION_GAPS_CACHE_TTL_MS,
            });
            return result;
        }
        catch (error: any) {
            const detail = error?.response?.data?.detail || error?.message || 'AI service unavailable';
            this.logger.warn(`Question-gaps proxy failed: ${detail}`);
            return {
                status: 'error',
                degraded: true,
                reason: detail,
                total_queries: 0,
                clusters: [],
                top_gaps: [],
                summary: 'Dịch vụ AI đang tạm thời không khả dụng. Dữ liệu khoảng trống sẽ hiển thị khi dịch vụ hoạt động lại.',
            };
        }
    }
    async extractEntities(text: string) {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/knowledge/extract`, { text }, { timeout: 15000 }));
            return response.data;
        }
        catch (error: any) {
            this.logger.warn(`Knowledge Graph extract proxy failed: ${error.message}`);
            return {
                entities: [],
                linked_nodes: [],
                confidence: 0,
                degraded: true,
                reason: error.message,
            };
        }
    }
    async triggerKnowledgeGraphSync(background = false) {
        try {
            this.httpService
                .post(`${this.aiServiceUrl}/api/ai/knowledge/seed?background=${background}`, {}, { timeout: background ? 5000 : 60000 })
                .subscribe({
                next: () => this.logger.log('Triggered knowledge graph sync'),
                error: (err: any) => this.logger.warn(`Knowledge graph sync failed: ${err.message}`),
            });
            return { success: true, message: 'Đã kích hoạt đồng bộ knowledge graph.' };
        }
        catch (error: any) {
            this.logger.warn(`Failed to trigger knowledge graph sync: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
    private static readonly LANGUAGE_CACHE_TTL_MS = 24 * 3600 * 1000;
    private static readonly LANGUAGE_CACHE_MAX = 200;
    private readonly _languageCache = new Map<string, {
        data: any;
        expires: number;
    }>();
    async simplifyText(text: string, difficulty: string, context?: string): Promise<any> {
        const key = `lang:simplify:${difficulty}:${this._hash(text)}`;
        const now = Date.now();
        const cached = this._languageCache.get(key);
        if (cached && cached.expires > now) {
            this.logger.log(`language-bridge simplify cache hit: ${key}`);
            return { ...cached.data, cached: true };
        }
        if (cached)
            this._languageCache.delete(key);
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/language/simplify`, {
                text,
                difficulty,
                context: context || null,
            }, { timeout: 45000 }));
            const result = response.data || {};
            this._evictLanguageCache();
            this._languageCache.set(key, {
                data: result,
                expires: now + AIService.LANGUAGE_CACHE_TTL_MS,
            });
            return result;
        }
        catch (error: any) {
            this.logger.error(`AI Language Bridge simplify unavailable: ${error.message}`);
            return {
                simplified: '',
                explained_terms: {},
                degraded: true,
                reason: 'Dịch vụ AI Language Bridge tạm thời không khả dụng.',
                difficulty,
                cached: false,
                created_at: new Date().toISOString(),
            };
        }
    }
    async translateText(text: string, targetLanguage: string, sourceLanguage?: string, glossary?: Record<string, string>): Promise<any> {
        const key = `lang:translate:${targetLanguage}:${sourceLanguage || 'auto'}:${this._hash(text)}`;
        const now = Date.now();
        const cached = this._languageCache.get(key);
        if (cached && cached.expires > now) {
            this.logger.log(`language-bridge translate cache hit: ${key}`);
            return { ...cached.data, cached: true };
        }
        if (cached)
            this._languageCache.delete(key);
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/language/translate`, {
                text,
                target_language: targetLanguage,
                source_language: sourceLanguage || null,
                glossary: glossary || null,
            }, { timeout: 45000 }));
            const result = response.data || {};
            this._evictLanguageCache();
            this._languageCache.set(key, {
                data: result,
                expires: now + AIService.LANGUAGE_CACHE_TTL_MS,
            });
            return result;
        }
        catch (error: any) {
            this.logger.error(`AI Language Bridge translate unavailable: ${error.message}`);
            return {
                translated: text,
                detected_source: sourceLanguage || null,
                degraded: true,
                reason: 'Dịch vụ AI Language Bridge tạm thời không khả dụng.',
                target_language: targetLanguage,
                cached: false,
                created_at: new Date().toISOString(),
            };
        }
    }
    async synthesizeSpeech(text: string, language: string, voice?: string): Promise<any> {
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/ai/language/tts`, {
                text,
                language,
                voice: voice || null,
            }, { timeout: 30000 }));
            return response.data || {};
        }
        catch (error: any) {
            this.logger.error(`AI Language Bridge TTS unavailable: ${error.message}`);
            return {
                audio_base64: null,
                audio_format: 'mp3',
                duration_ms: 0,
                provider: null,
                degraded: true,
                reason: 'Dịch vụ TTS tạm thời không khả dụng. Dùng Web Speech API của trình duyệt.',
                language: language,
                cached: false,
                created_at: new Date().toISOString(),
            };
        }
    }
    private _hash(s: string): string {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) & 0x7fffffff;
        }
        return h.toString(36);
    }
    private _evictLanguageCache() {
        if (this._languageCache.size >= AIService.LANGUAGE_CACHE_MAX) {
            const oldestKey = this._languageCache.keys().next().value;
            if (oldestKey)
                this._languageCache.delete(oldestKey);
        }
    }
}
