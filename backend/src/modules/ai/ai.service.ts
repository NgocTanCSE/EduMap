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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(LearningMaterial) private readonly materialRepo: Repository<LearningMaterial>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(ChatHistory) private readonly historyRepo: Repository<ChatHistory>,
    @InjectRepository(QueryLog) private readonly queryLogsRepo: Repository<QueryLog>,
    private readonly sessionMemory: SessionMemoryService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
  }

  /**
   * Kích hoạt đồng bộ tri thức từ Database sang AI Vector Store (ChromaDB) chạy ngầm
   */
  triggerKnowledgeSync(): void {
    try {
      this.httpService
        .post(`${this.aiServiceUrl}/api/ai/sync-knowledge?background=true`, {}, { timeout: 5000 })
        .subscribe({
          next: () => this.logger.log('Triggered AI knowledge sync in background'),
          error: (err) => this.logger.warn(`Failed to trigger AI knowledge sync: ${err.message}`),
        });
    } catch (error: any) {
      this.logger.warn(`Failed to trigger AI knowledge sync: ${error.message}`);
    }
  }

  /**
   * TỰ ĐỘNG NHÚNG (Embed) một tài liệu mới (sách / địa điểm) vào Vector DB.
   * Gọi ngay khi có sách hay địa điểm mới — thay thế triggerKnowledgeSync()
   * (full re-sync) bằng một phép nhúng độc lập, tăng tốc và không tốn tài nguyên.
   */
  async embedDocument(
    docText: string,
    metadata: Record<string, any>,
    docId: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/embed`,
          { text: docText, metadata, id: docId },
          { timeout: 15000 },
        ),
      );
      this.logger.log(`[Auto-Embed] Document '${docId}' embedded into vector DB.`);
    } catch (error: any) {
      // Không làm gián đoạn luồng tạo — chỉ log cảnh báo
      this.logger.warn(`[Auto-Embed] Failed to embed '${docId}': ${error.message}`);
    }
  }

  /**
   * Lấy lịch sử chat của người dùng từ Database
   */
  async getUserHistory(userId: string) {
    try {
      return await this.historyRepo.find({
        where: { userId: userId },
        order: { createdAt: 'ASC' },
        take: 50,
      });
    } catch (error: any) {
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
        .andWhere(
          '(LOWER(material.title) LIKE LOWER(:query) OR LOWER(material.description) LIKE LOWER(:query))',
          { query: normalizedQuery },
        )
        .orderBy('material.view_count', 'DESC')
        .take(limit)
        .getMany(),
      this.locationRepo
        .createQueryBuilder('location')
        .select(['location.id', 'location.name', 'location.description', 'location.address'])
        .where(
          'LOWER(location.name) LIKE LOWER(:query) OR LOWER(location.description) LIKE LOWER(:query)',
          { query: normalizedQuery },
        )
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

  /**
   * Dự đoán lộ trình nghề nghiệp dựa trên thông tin người dùng
   * Cập nhật Endpoint sang /api/ai/career/recommend để nhận dữ liệu cấu trúc mảng
   */
  async predictCareerPath(userData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend`, userData, {
          timeout: 60000,
        }),
      );
      // Trả về top_careers để khớp với mong đợi của Frontend
      return response.data.top_careers || response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Career Recommend API: ${error.message}`);
      throw new HttpException(
        'AI Career recommendation service is currently unavailable. Please ensure AI_SERVICE_URL is configured correctly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Semantic-vector career recommendation via ChromaDB (replaces if-else keyword
   * matching in CareerService.suggestCareer). Calls ai-service
   * POST /api/ai/career/recommend-semantic.
   * Returns null on failure so callers can fall back to the existing keyword logic.
   */
  async recommendCareerSemantic(
    skills: string[],
    interests: string[],
    experienceLevel: string,
    userId: string,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/career/recommend-semantic`,
          {
            skills,
            interests: interests || [],
            experience_level: experienceLevel || 'beginner',
            user_id: userId,
          },
          { timeout: 60000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Semantic Career Recommend unavailable: ${error.message}`);
      return null;
    }
  }

  /**
   * Gửi thông tin địa điểm học tập + tiêu chí người dùng tới AI service để
   * sinh giải thích tại sao địa điệml được đề xuất. Graceful degrade: trả về
   * null khi AI service không khả dụng (caller falls back to static template).
   */
  async explainLearningSpace(spot: any, preferences: any): Promise<any | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/learning-space/explain`,
          {
            spot,
            preferences,
          },
          { timeout: 10000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Learning Space Explain unavailable: ${error.message}`);
      return null;
    }
  }

  /**
   * Builds the dynamic system context (available books + educational locations)
   * that is sent to the ai-service and stored alongside chat history.
   *
   * CHANGED: Instead of always fetching the top-5 materials by view_count and
   * top-10 locations (hardcoded, query-agnostic), this method now does
   * **query-relevant** retrieval:
   *   1. Search materials whose title/description match the user's message
   *      (keyword filter), falling back to top-viewed if no match.
   *   2. Search locations whose name/address match the message, with a
   *      preference for locations discussed in the current session
   *      (via SessionMemoryService.getSessionContext).
   *   3. Include session topics as extra context so the LLM can reference
   *      what's already been discussed in this conversation.
   * This reduces token waste and improves RAG relevance.
   */
  private async _buildSystemContext(message: string, context: any): Promise<any> {
    const sessionContext = this.sessionMemory.getSessionContext(context?.session_id || '');
    const sessionTopics = sessionContext.topics;

    // Build a keyword from the user message + session topics
    // e.g. "tìm học bổng" + ["học bổng", "trường"] → search terms
    const msgLower = (message || '').toLowerCase();
    const searchTerms = [...sessionTopics, ...(message ? [message] : [])].join(' ').toLowerCase();

    // --- Query-relevant materials ---
    let materials: any[] = [];
    let points: any[] = [];
    try {
      const normQuery = `%${(message || '').trim()}%`;

      // If the message contains domain keywords, do a keyword search;
      // otherwise fall back to top-viewed (original behaviour).
      const hasKeywordMatch =
        sessionTopics.length > 0 ||
        /hoc|bong|truong|ai|mentor|nganh|lộ trình|wifi|stem|thuvien|sach/i.test(msgLower);

      const [materialsResult, pointsResult] = await Promise.all([
        hasKeywordMatch
          ? this.materialRepo
              .createQueryBuilder('material')
              .where(
                'material.deleted_at IS NULL AND ' +
                  '(LOWER(material.title) LIKE LOWER(:q) OR LOWER(material.description) LIKE LOWER(:q))',
                { q: `%${searchTerms}%` },
              )
              .orderBy('material.view_count', 'DESC')
              .take(5)
              .getMany()
          : this.materialRepo.find({ take: 5, order: { view_count: 'DESC' } }),

        hasKeywordMatch
          ? this.locationRepo
              .createQueryBuilder('location')
              .leftJoinAndSelect('location.category', 'category')
              .where(
                'location.status = :status AND ' +
                  '(LOWER(location.name) LIKE LOWER(:q) OR LOWER(location.address) LIKE LOWER(:q))',
                { status: 'active', q: `%${searchTerms}%` },
              )
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
    } catch (dbError: any) {
      this.logger.error(`Database context error: ${dbError.message}`);
    }

    return {
      available_books: materials.map((m) => m.title),
      educational_locations: points.map(
        (p) => `${p.name} (${p.category?.display_name}) at ${p.address}`,
      ),
      user_message: message,
      session_topics: sessionTopics,
      ...(context || {}),
    };
  }

  /**
   * SSE streaming proxy — pipes the ai-service /chat/stream response directly
   * to the NestJS response object so tokens arrive real-time on the frontend.
   *
   * In addition to forwarding raw SSE bytes, this method intercepts each chunk
   * to reconstruct the full reply + sources, then persists them via
   * historyRepo — mirroring the non-streaming chat() method.
   *
   * This is critical on HF Spaces where DB_TYPE=sqlite: the ai-service runs
   * with db_service=None (no PostgreSQL) and cannot persist chat history
   * itself. The NestJS SQLite historyRepo is therefore the single source of
   * truth for the streaming conversation session.
   */
  async chatStream(
    message: string,
    history: any[],
    ctx: any,
    userId: string,
    res: any,
    sessionId?: string,
  ) {
    let sourceStream: any;
    let systemContext: any = ctx || {};

    // --- Session memory integration ---
    // Get or create a session so we can track conversation topics and
    // provide query-relevant SQL context (instead of always top-5/top-10).
    const sid = sessionId || (userId ? `sess_${userId}` : undefined);
    if (userId) {
      try {
        const session = this.sessionMemory.getOrCreateSession(userId, sid);
        // If client sent no/empty history, use session's recent history
        if (!history || history.length === 0) {
          history = this.sessionMemory.getRecentHistory(session.id, 6);
        }
        // Ensure _buildSystemContext picks up session topics
        systemContext = { ...systemContext, session_id: session.id };
      } catch (e) {
        this.logger.warn(`Session memory error in chatStream: ${(e as any).message}`);
      }
    }

    // Build system context ONCE — it depends only on the message + DB state,
    // not on the ai-service being available. Building it inside the retry loop
    // would wastefully re-run database queries on every failed attempt.
    try {
      systemContext = await this._buildSystemContext(message, systemContext);
    } catch (ctxError: any) {
      this.logger.warn(`Error building system context for chatStream: ${ctxError.message}`);
    }

    // Retry loop: ai-service may be restarting after an HF Spaces secret change
    // (Space restart causes ~30-60s downtime) or may still be initializing
    // (Python imports + ChromaDB seeding + LLM provider preflight can take
    // 10-15s on a cold start). Retry up to 7 times with 3s backoff before
    // giving up with 503 — the previous 3×2s (6s) was too short for HF Spaces
    // cold starts, causing spurious 503s on first user request after deploy.
    let lastError: any;
    let response: any;
    const maxRetries = 7;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Per-attempt timeout: 10s (was 15s). A hung ai-service should not
        // block the stream for 15s per retry; 10s × 7 ≈ 70s ceiling which
        // still fits within typical reverse-proxy timeouts.
        response = await this.httpService.axiosRef.post(
          `${this.aiServiceUrl}/api/ai/chat/stream`,
          { message, history, context: systemContext, user_id: userId },
          { responseType: 'stream', timeout: 10000 },
        );
        sourceStream = response.data;
        break; // success
      } catch (error: any) {
        lastError = error;

        // Retryable errors:
        //  - ECONNREFUSED / ECONNRESET / EAI_AGAIN: ai-service process not
        //    yet listening (cold start, crash-restart cycle, Space restart).
        //  - HTTP 503 from ai-service: uvicorn is up but llm_service.is_ready
        //    is False (no API keys configured yet, or all providers down).
        //    On HF Spaces the Space may have just restarted and env vars
        //    (secrets) are still being injected into the process environ.
        const isConnRefused =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' ||
          (error.message &&
            (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
        const isServiceUnavailable = error.response && error.response.status === 503;
        const isRetryable = isConnRefused || isServiceUnavailable;

        if (attempt < maxRetries && isRetryable) {
          this.logger.warn(
            `AI service not ready (attempt ${attempt}/${maxRetries}), retrying in 3s...`,
          );
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        // Non-retryable error or exhausted retries
        if (!res.headersSent) {
          const detail =
            lastError.response?.data?.detail ||
            lastError.response?.data?.message ||
            lastError.message ||
            'Connection refused — ai-service may be restarting.';
          res.status(503).json({
            message: 'AI streaming service is unavailable.',
            detail: detail,
          });
        }
        return;
      }
    }

    // Accumulate the full reply + sources to persist chat history once the
    // stream completes. The ai-service emits SSE chunks shaped as:
    //   data: {"sources": [...], "meta": true}        (metadata, first)
    //   data: {"token": "h", "is_final": false}       (token-by-token)
    //   data: {"done": true}                          (completion)
    //   data: {"token": "...", "is_final": true, "done": true}  (fallback/cache)
    let fullReply = '';
    let sources: any[] = [];
    let buffer = '';

    const saveToHistory = () => {
      if (!userId || !fullReply) return;
      // Fire-and-forget — a DB failure must never tear down an already-
      // delivered stream. Errors are logged, not re-thrown.
      this.historyRepo
        .save(
          this.historyRepo.create({
            userId: userId,
            message: message,
            response: fullReply,
            context: { ...systemContext, sources },
          }),
        )
        .catch((saveError: any) =>
          this.logger.error(`Error saving streaming chat history: ${saveError.message}`),
        );
      // Anonymized query log (Idea #17): fire-and-forget, never breaks stream.
      this._logQuery(userId, message, sources, fullReply);
      // Also save to session memory for short-term context
      if (userId && sid) {
        this.sessionMemory.addTurn(sid, message, fullReply);
      }
    };

    const safeEnd = () => {
      try {
        res.end();
      } catch {
        /* response already closed */
      }
    };

    // If the client disconnects mid-stream, destroy the upstream so we don't
    // keep consuming tokens we'll never deliver.
    res.on('close', () => {
      if (sourceStream && !sourceStream.destroyed) {
        sourceStream.destroy();
      }
    });

    sourceStream.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

      // 1. Forward raw SSE bytes to the client (real-time token delivery).
      res.write(text);

      // 2. Parse SSE events to reconstruct the full reply + sources for DB
      //    persistence. Each event is "data: {json}\n\n".
      buffer += text;
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (Array.isArray(parsed.sources)) sources = parsed.sources;
          if (typeof parsed.token === 'string') fullReply += parsed.token;
        } catch {
          // Malformed SSE chunk — the client still receives the raw bytes
          // forwarded above, so parsing errors here are non-fatal.
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

  /**
   * AI Map Agent — non-streaming proxy.
   * Forwards the natural-language question to the ai-service agent loop
   * (/api/ai/agent/chat) which calls query_sqlite / geo_recommend /
   * geo_density / rag_search tools and returns a summary with evidence.
   */
  async agentChat(message: string, history: any[], ctx: any, userId?: string, sessionId?: string) {
    const sid = sessionId || (userId ? `sess_${userId}` : undefined);
    let systemContext = { ...(ctx || {}), session_id: sid };

    try {
      systemContext = await this._buildSystemContext(message, systemContext);
    } catch (ctxError: any) {
      this.logger.warn(`Error building system context for agentChat: ${ctxError.message}`);
    }

    const payload: any = {
      message,
      history,
      context: systemContext,
      session_id: sid,
    };
    if (userId) payload.user_id = userId;

    let lastError: any;
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.aiServiceUrl}/api/ai/agent/chat`, payload, {
            timeout: 30000,
          }),
        );
        return response.data;
      } catch (error: any) {
        lastError = error;
        const isConnRefused =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' ||
          (error.message && error.message.includes('ECONNREFUSED'));
        const isServiceUnavailable = error.response && error.response.status === 503;
        const isRetryable = isConnRefused || isServiceUnavailable;

        if (attempt < maxRetries && isRetryable) {
          this.logger.warn(
            `AI agent service not ready (attempt ${attempt}/${maxRetries}), retrying in 3s...`,
          );
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        const status = error?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const detail =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          'AI agent service is currently unavailable.';
        throw new HttpException(detail, status);
      }
    }
    throw new HttpException(
      lastError?.response?.data?.detail || 'AI agent service unavailable.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * AI Map Agent — SSE streaming proxy (mirrors chatStream).
   * Pipes the ai-service /api/ai/agent/chat-stream SSE stream to the client.
   */
  async agentChatStream(
    message: string,
    history: any[],
    ctx: any,
    userId: string,
    res: any,
    sessionId?: string,
  ) {
    const sid = sessionId || (userId ? `sess_${userId}` : undefined);
    let systemContext = { ...(ctx || {}), session_id: sid };

    if (userId) {
      try {
        const session = this.sessionMemory.getOrCreateSession(userId, sid);
        if (!history || history.length === 0) {
          history = this.sessionMemory.getRecentHistory(session.id, 6);
        }
        systemContext = { ...systemContext, session_id: session.id };
      } catch (e) {
        this.logger.warn(`Session memory error in agentChatStream: ${(e as any).message}`);
      }
    }

    try {
      systemContext = await this._buildSystemContext(message, systemContext);
    } catch (ctxError: any) {
      this.logger.warn(`Error building system context for agentChatStream: ${ctxError.message}`);
    }

    const payload: any = {
      message,
      history,
      context: systemContext,
      session_id: sid,
    };
    if (userId) payload.user_id = userId;

    let response: any;
    let lastError: any;
    const maxRetries = 7;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await this.httpService.axiosRef.post(
          `${this.aiServiceUrl}/api/ai/agent/chat-stream`,
          payload,
          { responseType: 'stream', timeout: 10000 },
        );
        break;
      } catch (error: any) {
        lastError = error;
        const isConnRefused =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' ||
          (error.message &&
            (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
        const isServiceUnavailable = error.response && error.response.status === 503;
        const isRetryable = isConnRefused || isServiceUnavailable;

        if (attempt < maxRetries && isRetryable) {
          this.logger.warn(
            `AI agent streaming not ready (attempt ${attempt}/${maxRetries}), retrying in 3s...`,
          );
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (!res.headersSent) {
          const detail =
            lastError.response?.data?.detail ||
            lastError.response?.data?.message ||
            lastError.message ||
            'AI agent streaming service is currently unavailable.';
          res.status(503).json({
            message: 'AI agent streaming service is unavailable.',
            detail,
          });
        }
        return;
      }
    }

    const sourceStream = response.data;
    let buffer = '';
    let fullReply = '';
    let sources: any[] = [];

    const saveToHistory = () => {
      if (!userId || !fullReply) return;
      this.historyRepo
        .save(
          this.historyRepo.create({
            userId: userId,
            message: message,
            response: fullReply,
            context: { ...systemContext, sources, session_id: sid },
          }),
        )
        .catch((saveError: any) =>
          this.logger.error(`Error saving streaming agent chat history: ${saveError.message}`),
        );
      if (userId && sid) {
        this.sessionMemory.addTurn(sid, message, fullReply);
      }
    };

    const safeEnd = () => {
      try {
        res.end();
      } catch {
        /* already closed */
      }
    };

    // Destroy upstream if client disconnects mid-stream
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
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (Array.isArray(parsed.sources)) sources = parsed.sources;
          if (typeof parsed.token === 'string') fullReply += parsed.token;
        } catch {
          // non-fatal — client still receives raw bytes
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

  /**
   * Phân tích xu hướng thị trường lao động
   */
  async getMarketTrends() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/trends`, { timeout: 20000 }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Trends API: ${error.message}`);
      throw new HttpException(
        'AI Market trends service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI DATA QUALITY: Generate anomaly report for POI data integrity.
   * Proxies to ai-service POST /api/ai/data/quality/report.
   */
  async dataQualityReport(params?: { category?: string; limit?: number; include_clean?: boolean }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/data/quality/report`, params || {}, {
          timeout: 30000,
        }),
      );
      return response.data;
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'AI Data Quality service is currently unavailable.';
      this.logger.error(`Error calling AI Data Quality API: ${detail}`);
      throw new HttpException(
        'Dịch vụ phân tích chất lượng dữ liệu AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI DASHBOARD: Get personalized daily insight
   * Returns null (instead of throwing) when the AI service is unavailable so
   * callers can degrade gracefully without polluting error logs.
   */
  async getDailyInsight(dashboardData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/analytics/daily-insight`,
          {
            dashboard_data: dashboardData,
          },
          { timeout: 60000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Daily Insight unavailable, using local fallback: ${error.message}`);
      return null;
    }
  }

  /**
   * AI GEO-ANALYSIS: Analyze education density and suggest areas for improvement
   */
  async analyzeGeoDensity(geoData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, geoData, {
          timeout: 45000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Geo-Analyze API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ phân tích địa lý AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI LIBRARY: Generate summary and study guide for a learning material
   */
  async summarizeMaterial(materialData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/library/summarize`, materialData, {
          timeout: 60000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Library Summarize API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ tóm tắt AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI LEARNING PATH: Generate a personalized study plan
   */
  async generateLearningPath(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/learning-path/`, data, {
          timeout: 60000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Learning Path API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ tạo lộ trình học tập AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI MENTOR: Match student with the best mentors
   */
  async matchMentor(matchData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/mentor/match`, matchData, {
          timeout: 45000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Mentor Match API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ ghép nối AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI IMPACT-MATCH: Rank need↔sponsor pairs after SQLite pre-filter.
   * Mirrors matchMentor() but targets /api/ai/impactmatch/rank.
   * The ImpactMatchService already pre-filtered by cost/location/category
   * (LIMIT 15) to keep the LLM payload small and avoid token overflow.
   */
  async impactMatchRank(rankData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/impactmatch/rank`, rankData, {
          timeout: 45000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI ImpactMatch Rank API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ ghép nối AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI IMPACT MEASUREMENT (Idea #19): trend analysis + confidence interval +
   * impact score + LLM narrative.
   *
   * Proxies to the ai-service POST /api/ai/impact/measure. The backend
   * ImpactMeasurementService already computed the before/after diff (T1) and
   * hands it (together with the deployment timeline) as ``pre_computed`` so
   * the AI service focuses on the analytics + narrative (T2). Returns null
   * on failure so the caller can degrade to the backend-only diff.
   */
  async measureImpact(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/impact/measure`, data, {
          timeout: 30000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Impact Measure unavailable (will degrade): ${error.message}`);
      return null;
    }
  }

  /**
   * Voice-to-Geo AI (Idea #16, Task 2) — server-side Speech-to-Text fallback.
   *
   * Proxies POST /ai/speech/to-text → ai-service POST /api/ai/speech/to-text
   * (OpenRouter Whisper via curl). The ai-service already returns 200 with
   * degraded=True on failure; here we additionally degrade when the
   * ai-service itself is unreachable so the frontend keeps the client-side
   * Web Speech transcript instead of erroring.
   */
  async speechToText(payload: {
    audio_base64: string;
    audio_format?: string;
    language?: string;
  }): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/speech/to-text`, payload, {
          timeout: 30000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Speech-to-Text fallback unavailable: ${error.message}`);
      // Graceful degradation: the frontend will fall back to the client-side
      // Web Speech API text it already captured.
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

  /**
   * AI RESOURCE-EXCHANGE: Rank resource↔request pairs after SQLite pre-filter
   * + scoring, and obtain the LLM explanation + greedy transport schedule.
   * Mirrors impactMatchRank() but targets /api/ai/resource-exchange/match-rank.
   *
   * The ResourceMatchService already pre-filtered by type/condition/region
   * and capped at 15 pairs (MAX_PAIRS_TO_LLM) to keep the LLM payload small.
   */
  async resourceExchangeMatchRank(rankData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/resource-exchange/match-rank`,
          rankData,
          { timeout: 45000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI ResourceExchange MatchRank API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ ghép nối nguồn lực AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI COMMUNITY: Moderate user-generated content
   */
  async moderateContent(userId: string, text: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/moderate/`,
          {
            user_id: userId,
            text: text,
          },
          { timeout: 15000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      // Surface the AI service's own error detail (which includes a per-
      // provider breakdown) instead of a generic "unavailable" string, so
      // operators can see exactly which provider failed and why.
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        'AI Content moderation service is currently unavailable.';
      this.logger.error(`Error calling AI Moderation API: ${detail}`);
      throw new HttpException(detail, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * AI SCHOLARSHIP: Check if student profile matches scholarship requirements.
   * Nhận thêm transcriptData (được trích xuất từ PDF bảng điểm) để tính GPA chính xác.
   */
  async checkScholarshipEligibility(userData: any, scholarshipData: any, transcriptData?: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/scholarship/check`,
          {
            user_data: userData,
            scholarship_data: scholarshipData,
            transcript_data: transcriptData,
          },
          { timeout: 45000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Scholarship Check API: ${error.message}`);
      throw new HttpException(
        'AI Scholarship eligibility service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI OPPORTUNITY RADAR (T2): NLP criteria extraction + semantic matching.
   *
   * Proxies the pre-filtered opportunity candidates + user profile to the
   * ai-service POST /api/ai/opportunity/match endpoint. That endpoint extracts
   * eligibility criteria (GPA, major, skills, language, experience) from each
   * opportunity's text via the LLM, computes a match score (0–100) with a
   * confidence (threshold 0.6), filters expired deadlines and builds a
   * required-document checklist.
   *
   * Timeouts follow the AGENTS.md embedding budget rules — a slow provider
   * must never starve the fallbacks or leave the radar empty.
   */
  async matchOpportunities(data: { user_profile: any; opportunities: any[] }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/opportunity/match`, data, {
          timeout: 45000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling AI Opportunity Match API: ${error.message}`);
      throw new HttpException(
        'AI Opportunity Radar service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI Analytics Stats
   */
  async getAnalyticsStats() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/analytics/stats`, { timeout: 15000 }),
      );
      const data = response.data || {};
      const historicalData = Array.isArray(data.historical_data) ? data.historical_data : [];
      const insights = data.insights || {};
      const lastValue =
        historicalData.length > 0
          ? Number(
              historicalData[historicalData.length - 1].value ||
                historicalData[historicalData.length - 1].metric_value ||
                0,
            )
          : 0;
      const accuracyRate = insights.average_annual_growth_pct
        ? Math.min(0.99, 0.75 + Math.abs(Number(insights.average_annual_growth_pct)) / 100)
        : 0.9;
      // chat_histories may be absent on older SQLite deployments. A failed
      // count must not turn the whole trends endpoint into a 503.
      let totalPredictions = 0;
      try {
        totalPredictions = await this.historyRepo.count();
      } catch (countError: any) {
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
          // Pass the grouped sector history through — the trends page renders
          // one growth chart per sector and previously always received [].
          sectors: Array.isArray(data.sectors) ? data.sectors : [],
          trending_skills: Array.isArray(data.trending_skills) ? data.trending_skills : [],
          // Provenance of the hot-skill list — "adzuna" when extracted from
          // live Adzuna job postings, "local" from the seeded SQLite jobs
          // table. Lets the UI report an honest data source.
          trending_skills_source: data.trending_skills_source || 'local',
          insights,
          last_value: lastValue,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching AI analytics stats: ${error.message}`);
      throw new HttpException(
        'AI Analytics stats service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Chatbot AI am hiểu dữ liệu hệ thống (RAG Lite)
   *
   * CHANGED: Added sessionId parameter for session-based memory.
   *   - If sessionId provided, retrieves recent history from the session
   *     (in-memory) instead of relying solely on the client-sent history.
   *   - Saves each turn to the session so context persists across messages.
   *   - Passes session_id to _buildSystemContext for query-relevant context.
   */
  async chat(message: string, history: any[], context: any, userId?: string, sessionId?: string) {
    const sid = sessionId || (userId ? `sess_${userId}` : undefined);

    // Get or create a session for memory tracking
    if (userId) {
      const session = this.sessionMemory.getOrCreateSession(userId, sid);
      // If the client didn't send full history, use the session's recent history
      if (!history || history.length === 0) {
        history = this.sessionMemory.getRecentHistory(session.id, 6);
      }
      // Inject session_id into context so _buildSystemContext can read topics
      context = { ...(context || {}), session_id: session.id };
    }

    // 1. Enrich context with system data (shared with chatStream)
    const systemContext = await this._buildSystemContext(message, context);

    // 2. Gửi sang AI Service — with retry for transient ai-service unavailability
    //    (HF Spaces cold start, Space restart, secret rotation). Mirrors the
    //    retry logic in chatStream but uses firstValueFrom (non-streaming).
    let lastError: any;
    let response: any;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await firstValueFrom(
          this.httpService.post(
            `${this.aiServiceUrl}/api/ai/chat`,
            {
              user_id: userId,
              message: message,
              history: history,
              context: systemContext,
            },
            { timeout: 60000 },
          ), // 60s — AI service self-bounds CF+HF attempts to ~50s so its template fallback still fits
        );
        break; // success
      } catch (error: any) {
        lastError = error;

        // Retryable: connection refused (ai-service not listening) or 503
        // (ai-service up but llm_service.is_ready is False — common right
        // after an HF Spaces Space restart when secrets are being injected).
        const isConnRefused =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET' ||
          (error.message &&
            (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN'))) ||
          (error.message && error.message.includes('ETIMEDOUT'));
        const isServiceUnavailable = error.response && error.response.status === 503;
        const isRetryable = isConnRefused || isServiceUnavailable;

        if (attempt < maxRetries && isRetryable) {
          this.logger.warn(
            `AI chat service not ready (attempt ${attempt}/${maxRetries}), retrying in 2s...`,
          );
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        // Exhausted retries or non-retryable error — fall through to throw
        const status = error?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const detail =
          error?.response?.data?.detail || error?.response?.data?.message || error?.message;

        this.logger.error(`Error in AI Chat [status ${status}]: ${detail}`);

        if (error?.response?.data?.detail) {
          throw new HttpException(error.response.data.detail, status);
        }

        throw new HttpException(
          detail ||
            'AI Chat service is currently unavailable. Please ensure AI_SERVICE_URL and CLOUDFLARE_API_TOKEN are configured correctly.',
          status,
        );
      }
    }

    const aiReply = response.data.reply || response.data.message;
    const sources = response.data.sources || [];

    // 3. Persistent: Lưu vào Database nếu có userId
    if (userId) {
      try {
        const newChat = this.historyRepo.create({
          userId: userId,
          message: message,
          response: aiReply,
          context: systemContext,
        });
        await this.historyRepo.save(newChat);
      } catch (saveError: any) {
        this.logger.error(`Error saving chat history: ${saveError.message}`);
      }
    }

    // 3b. Anonymized query log (Idea #17): fire-and-forget, never breaks chat.
    this._logQuery(userId, message, sources, aiReply);

    // 4. Session memory: save the turn for future context
    if (userId && sid) {
      this.sessionMemory.addTurn(sid, message, aiReply);
    }

    return response.data;
  }

  /**
   * ─── AI Knowledge Graph (Idea #8) proxy methods ──────────────────────
   * Forward to the FastAPI ai-service at /api/ai/knowledge/*.
   * All methods degrade gracefully (return empty / degraded payload) when
   * the ai-service is restarting (HF Spaces cold start) — never 503 the
   * frontend, so the graph page shows an empty state instead of crashing.
   */

  /** GET /api/ai/knowledge/graph — returns {nodes, edges, meta} */
  async getKnowledgeGraph(nodeTypes?: string[], limit = 500) {
    const params = new URLSearchParams();
    if (nodeTypes && nodeTypes.length) params.set('node_types', nodeTypes.join(','));
    params.set('limit', String(limit));
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/knowledge/graph?${params.toString()}`, {
          timeout: 15000,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Knowledge Graph proxy failed: ${error.message}`);
      return { nodes: [], edges: [], meta: {}, degraded: true, reason: error.message };
    }
  }

  /** POST /api/ai/knowledge/query — 1-degree graph traversal */
  async queryKnowledgeGraph(nodeId: string, edgeTypes?: string[], depth = 1, limit = 50) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/knowledge/query`,
          {
            node_id: nodeId,
            edge_types: edgeTypes,
            depth,
            limit,
          },
          { timeout: 15000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`Knowledge Graph query proxy failed: ${error.message}`);
      return {
        start_node: null,
        neighbors: [],
        edges: [],
        meta: { degraded: true, reason: error.message },
      };
    }
  }

  /** POST /api/ai/knowledge/suggest-partners — gợi ý tài trợ/đối tác phù hợp */
  async suggestKnowledgePartners(query: string, limit = 10, focusType?: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/knowledge/suggest-partners`,
          {
            query,
            limit,
            focus_type: focusType,
          },
          { timeout: 15000 },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`Knowledge Graph suggest-partners proxy failed: ${error.message}`);
      return { query, count: 0, suggestions: [], degraded: true, reason: error.message };
    }
  }

  // ─── AI Question Gap Report (Idea #17) ─────────────────────────────────────

  /** SHA-256 hash a user_id for anonymization before it touches query_logs. */
  private _hashUserId(userId: string): string {
    return crypto.createHash('sha256').update(String(userId)).digest('hex');
  }

  /** Heuristic quality score (0.0–1.0) for an AI chat response.
   *  High source count + substantial reply → higher quality.
   *  No sources + short "I don't know" reply → low quality (likely a gap). */
  private _computeQuality(sources: any[], reply: string): number {
    const sourceCount = Array.isArray(sources) ? sources.length : 0;
    const replyLen = reply ? reply.length : 0;
    const retrievalScore = Math.min(1.0, sourceCount / 5);
    const replyScore = Math.min(1.0, replyLen / 500);
    // Retrieval is weighted slightly higher — no docs at all is a strong gap signal.
    return Number((retrievalScore * 0.6 + replyScore * 0.4).toFixed(3));
  }

  /** Derive a retrieval status string from the source list. */
  private _retrievalStatus(sources: any[]): string {
    const count = Array.isArray(sources) ? sources.length : 0;
    if (count >= 3) return 'success';
    if (count > 0) return 'partial';
    return 'failed';
  }

  /** Fire-and-forget anonymization + logging for Idea #17.
   *  Writes a single row to ``query_logs``.  Errors are swallowed — a
   *  logging failure must never break the user's chat experience. */
  private _logQuery(userId: string, message: string, sources: any[], reply: string): void {
    if (!userId) return;
    try {
      const userHash = this._hashUserId(userId);
      const retrievalStatus = this._retrievalStatus(sources);
      const quality = this._computeQuality(sources, reply);
      // Persist the response text truncated to 2 000 chars — enough for
      // gap analysis, avoids bloating the SQLite file with long replies.
      const responseText = reply ? reply.slice(0, 2000) : null;
      this.queryLogsRepo
        .save(
          this.queryLogsRepo.create({
            userIdHash: userHash,
            queryText: message,
            retrievedDocCount: Array.isArray(sources) ? sources.length : 0,
            retrievalStatus,
            responseText,
            responseQuality: quality,
          }),
        )
        .catch((err: any) => this.logger.error(`Error saving query log: ${err.message}`));
    } catch (err: any) {
      // Silent — analytics logging must never affect chat UX.
      this.logger.debug(`Query log skipped: ${err.message}`);
    }
  }

  /** GET /api/ai/question-gaps — proxy to the ai-service endpoint that
   *  clusters anonymized query_logs and identifies knowledge gaps.
   *  Results are cached on this side (30 min LRU, 50 entries) so the
   *  potentially slow clustering is not re-run on every admin page refresh. */
  private readonly QUESTION_GAPS_CACHE_MAX = 50;
  private readonly QUESTION_GAPS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
  private _questionGapsCache: Map<string, { data: any; expires: number }> = new Map();

  async getQuestionGaps(limit?: number): Promise<any> {
    const cacheKey = `qg:${limit || 0}`;
    const now = Date.now();
    const cached = this._questionGapsCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return { ...cached.data, cached: true };
    }
    if (cached) this._questionGapsCache.delete(cacheKey);

    try {
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/api/ai/analytics/question-gaps?${params.toString()}`,
          { timeout: 30000 },
        ),
      );
      const result = response.data || {};
      // Enforce cache size.
      if (this._questionGapsCache.size >= this.QUESTION_GAPS_CACHE_MAX) {
        const oldestKey = this._questionGapsCache.keys().next().value;
        if (oldestKey) this._questionGapsCache.delete(oldestKey);
      }
      this._questionGapsCache.set(cacheKey, {
        data: result,
        expires: now + this.QUESTION_GAPS_CACHE_TTL_MS,
      });
      return result;
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'AI service unavailable';
      this.logger.warn(`Question-gaps proxy failed: ${detail}`);
      return {
        status: 'error',
        degraded: true,
        reason: detail,
        total_queries: 0,
        clusters: [],
        top_gaps: [],
        summary:
          'Dịch vụ AI đang tạm thời không khả dụng. Dữ liệu khoảng trống sẽ hiển thị khi dịch vụ hoạt động lại.',
      };
    }
  }

  /** POST /api/ai/knowledge/extract — NLP entity extraction */
  async extractEntities(text: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/knowledge/extract`,
          { text },
          { timeout: 15000 },
        ),
      );
      return response.data;
    } catch (error: any) {
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

  /** POST /api/ai/knowledge/seed — (re)build the graph from source tables */
  async triggerKnowledgeGraphSync(background = false) {
    try {
      this.httpService
        .post(
          `${this.aiServiceUrl}/api/ai/knowledge/seed?background=${background}`,
          {},
          { timeout: background ? 5000 : 60000 },
        )
        .subscribe({
          next: () => this.logger.log('Triggered knowledge graph sync'),
          error: (err: any) => this.logger.warn(`Knowledge graph sync failed: ${err.message}`),
        });
      return { success: true, message: 'Đã kích hoạt đồng bộ knowledge graph.' };
    } catch (error: any) {
      this.logger.warn(`Failed to trigger knowledge graph sync: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // ─── AI Language Bridge (Idea #15) ──────────────────────────────────

  // In-process 24 h TTL cache (HF Spaces: no Redis) for simplify/translate.
  private static readonly LANGUAGE_CACHE_TTL_MS = 24 * 3600 * 1000;
  private static readonly LANGUAGE_CACHE_MAX = 200;
  private readonly _languageCache = new Map<string, { data: any; expires: number }>();

  /** POST /api/ai/language/simplify → proxy to ai-service.
   * Summarises text to a reading level with jargon explanation. Cached 24h. */
  async simplifyText(text: string, difficulty: string, context?: string): Promise<any> {
    const key = `lang:simplify:${difficulty}:${this._hash(text)}`;
    const now = Date.now();
    const cached = this._languageCache.get(key);
    if (cached && cached.expires > now) {
      this.logger.log(`language-bridge simplify cache hit: ${key}`);
      return { ...cached.data, cached: true };
    }
    if (cached) this._languageCache.delete(key);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/language/simplify`,
          {
            text,
            difficulty,
            context: context || null,
          },
          { timeout: 45000 },
        ),
      );
      const result = response.data || {};
      this._evictLanguageCache();
      this._languageCache.set(key, {
        data: result,
        expires: now + AIService.LANGUAGE_CACHE_TTL_MS,
      });
      return result;
    } catch (error: any) {
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

  /** POST /api/ai/language/translate → proxy to ai-service.
   * Context-aware translation with optional glossary. Cached 24h. */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    glossary?: Record<string, string>,
  ): Promise<any> {
    const key = `lang:translate:${targetLanguage}:${sourceLanguage || 'auto'}:${this._hash(text)}`;
    const now = Date.now();
    const cached = this._languageCache.get(key);
    if (cached && cached.expires > now) {
      this.logger.log(`language-bridge translate cache hit: ${key}`);
      return { ...cached.data, cached: true };
    }
    if (cached) this._languageCache.delete(key);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/language/translate`,
          {
            text,
            target_language: targetLanguage,
            source_language: sourceLanguage || null,
            glossary: glossary || null,
          },
          { timeout: 45000 },
        ),
      );
      const result = response.data || {};
      this._evictLanguageCache();
      this._languageCache.set(key, {
        data: result,
        expires: now + AIService.LANGUAGE_CACHE_TTL_MS,
      });
      return result;
    } catch (error: any) {
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

  /** POST /api/ai/language/tts → proxy to ai-service.
   * Text-to-speech. NOT cached (audio is large + user-controlled params). */
  async synthesizeSpeech(text: string, language: string, voice?: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/language/tts`,
          {
            text,
            language,
            voice: voice || null,
          },
          { timeout: 30000 },
        ),
      );
      return response.data || {};
    } catch (error: any) {
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

  /** Lightweight non-cryptographic hash for cache keys. */
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
      if (oldestKey) this._languageCache.delete(oldestKey);
    }
  }
}
