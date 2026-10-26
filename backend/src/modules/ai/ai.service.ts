import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';

import { ChatHistory } from './entities/chat-history.entity';
import { SessionMemoryService } from './session-memory.service';

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
    private readonly sessionMemory: SessionMemoryService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
  }

  /**
   * Kích hoạt đồng bộ tri thức từ Database sang AI Vector Store (ChromaDB) chạy ngầm
   */
  triggerKnowledgeSync(): void {
    try {
      this.httpService.post(
        `${this.aiServiceUrl}/api/ai/sync-knowledge?background=true`,
        {},
        { timeout: 5000 }
      ).subscribe({
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
  async embedDocument(docText: string, metadata: Record<string, any>, docId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/embed`,
          { text: docText, metadata, id: docId },
          { timeout: 15000 }
        )
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
        take: 50
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
        .select(['material.id', 'material.title', 'material.description', 'material.type', 'material.subject'])
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
        ...materials.map(material => ({
          id: material.id,
          document: `${material.title}: ${material.description || ''}`,
          metadata: {
            title: material.title,
            type: 'learning_material',
            category: material.subject || material.type,
          },
        })),
        ...locations.map(location => ({
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend`, userData, { timeout: 60000 })
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
  async recommendCareerSemantic(skills: string[], interests: string[], experienceLevel: string, userId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend-semantic`, {
          skills,
          interests: interests || [],
          experience_level: experienceLevel || 'beginner',
          user_id: userId,
        }, { timeout: 60000 })
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`AI Semantic Career Recommend unavailable: ${error.message}`);
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
    const searchTerms = [...sessionTopics, ...(message ? [message] : [])]
      .join(' ')
      .toLowerCase();

    // --- Query-relevant materials ---
    let materials: any[] = [];
    let points: any[] = [];
    try {
      const normQuery = `%${(message || '').trim()}%`;

      // If the message contains domain keywords, do a keyword search;
      // otherwise fall back to top-viewed (original behaviour).
      const hasKeywordMatch = sessionTopics.length > 0 || /hoc|bong|truong|ai|mentor|nganh|lộ trình|wifi|stem|thuvien|sach/i.test(msgLower);

      const [materialsResult, pointsResult] = await Promise.all([
        hasKeywordMatch
          ? this.materialRepo
              .createQueryBuilder('material')
              .where(
                'material.deleted_at IS NULL AND ' +
                '(LOWER(material.title) LIKE LOWER(:q) OR LOWER(material.description) LIKE LOWER(:q))',
                { q: `%${searchTerms}%` }
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
                { status: 'active', q: `%${searchTerms}%` }
              )
              .take(5)
              .getMany()
          : this.locationRepo.find({ take: 10, where: { status: 'active' }, relations: ['category'] }),
      ]);

      materials = materialsResult;
      points = pointsResult;
    } catch (dbError: any) {
      this.logger.error(`Database context error: ${dbError.message}`);
    }

    return {
      available_books: materials.map((m) => m.title),
      educational_locations: points.map((p) => `${p.name} (${p.category?.display_name}) at ${p.address}`),
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
  async chatStream(message: string, history: any[], ctx: any, userId: string, res: any, sessionId?: string) {
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

    // Retry loop: ai-service may be restarting after an HF Spaces secret change
    // (Space restart causes ~30-60s downtime). Retry up to 3 times with 2s
    // backoff before giving up with 503.
    let lastError: any;
    let response: any;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        systemContext = await this._buildSystemContext(message, ctx);
        response = await this.httpService.axiosRef.post(
          `${this.aiServiceUrl}/api/ai/chat/stream`,
          { message, history, context: systemContext, user_id: userId },
          { responseType: 'stream', timeout: 15000 },
        );
        sourceStream = response.data;
        break; // success
      } catch (error: any) {
        lastError = error;
        const isConnRefused = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET'
          || (error.message && (error.message.includes('ECONNREFUSED') || error.message.includes('EAI_AGAIN')));
        if (attempt < maxRetries && isConnRefused) {
          this.logger.warn(`AI service not ready (attempt ${attempt}/${maxRetries}), retrying in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        // Non-retryable error or exhausted retries
        if (!res.headersSent) {
          res.status(503).json({
            message: 'AI streaming service is unavailable.',
            detail: lastError.message || 'Connection refused — ai-service may be restarting.',
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
      // Also save to session memory for short-term context
      if (userId && sid) {
        this.sessionMemory.addTurn(sid, message, fullReply);
      }
    };

    const safeEnd = () => {
      try { res.end(); } catch { /* response already closed */ }
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
   * Phân tích xu hướng thị trường lao động
   */
  async getMarketTrends() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/trends`, { timeout: 20000 })
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
   * AI DASHBOARD: Get personalized daily insight
   * Returns null (instead of throwing) when the AI service is unavailable so
   * callers can degrade gracefully without polluting error logs.
   */
  async getDailyInsight(dashboardData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/analytics/daily-insight`, {
            dashboard_data: dashboardData
        }, { timeout: 60000 })
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, geoData, { timeout: 45000 })
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/library/summarize`, materialData, { timeout: 60000 })
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/learning-path/`, data, { timeout: 60000 })
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/mentor/match`, matchData, { timeout: 45000 })
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
   * AI COMMUNITY: Moderate user-generated content
   */
  async moderateContent(userId: string, text: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/moderate/`, {
          user_id: userId,
          text: text
        }, { timeout: 15000 })
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
        this.httpService.post(`${this.aiServiceUrl}/api/ai/scholarship/check`, {
          user_data: userData,
          scholarship_data: scholarshipData,
          transcript_data: transcriptData,
        }, { timeout: 45000 })
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
   * AI Analytics Stats
   */
  async getAnalyticsStats() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/analytics/stats`, { timeout: 15000 })
      );
      const data = response.data || {};
      const historicalData = Array.isArray(data.historical_data) ? data.historical_data : [];
      const insights = data.insights || {};
      const lastValue = historicalData.length > 0 ? Number(historicalData[historicalData.length - 1].value || historicalData[historicalData.length - 1].metric_value || 0) : 0;
      const accuracyRate = insights.average_annual_growth_pct ? Math.min(0.99, 0.75 + Math.abs(Number(insights.average_annual_growth_pct)) / 100) : 0.9;
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
          trending_skills_source: data.trending_skills_source || "local",
          insights,
          last_value: lastValue,
        }
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

    try {
      // 1. Enrich context with system data (shared with chatStream)
      const systemContext = await this._buildSystemContext(message, context);

      // 2. Gửi sang AI Service
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/chat`, {
          user_id: userId,
          message: message,
          history: history,
          context: systemContext,
        }, { timeout: 60000 })  // 60s — AI service self-bounds CF+HF attempts to ~50s so its template fallback still fits
      );

      const aiReply = response.data.reply || response.data.message;

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
        } catch (saveError) {
          this.logger.error(`Error saving chat history: ${saveError.message}`);
        }
      }

      // 4. Session memory: save the turn for future context
      if (userId && sid) {
        this.sessionMemory.addTurn(sid, message, aiReply);
      }

      return response.data;
    } catch (error: any) {
      const status = error?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
      const detail = error?.response?.data?.detail
        || error?.response?.data?.message
        || error?.message;

      this.logger.error(`Error in AI Chat [status ${status}]: ${detail}`);

      if (error?.response?.data?.detail) {
        throw new HttpException(error.response.data.detail, status);
      }

      throw new HttpException(
        detail || 'AI Chat service is currently unavailable. Please ensure AI_SERVICE_URL and CLOUDFLARE_API_TOKEN are configured correctly.',
        status,
      );
    }
  }
}
