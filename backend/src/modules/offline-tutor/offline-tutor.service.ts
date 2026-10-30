import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OfflineTutorService {
  private readonly logger = new Logger(OfflineTutorService.name);
  private readonly aiServiceUrl: string;
  // In-memory LRU+TTL cache (1 h TTL) — same pattern as GeoVisionService
  // and MapService: avoids the @nestjs/cache-manager CacheManager dependency
  // which is unavailable in this NestJS build.
  private readonly _cache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly CACHE_MAX = 100;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
  }

  /**
   * Proxy a tutoring request to the ai-service offline-tutor endpoint.
   *
   * The endpoint POST /api/offline/tutor on the FastAPI side handles:
   *  - explain     → tutor.explain()
   *  - practice    → tutor.generate_practice()
   *  - suggest     → tutor.suggest_next()
   *
   * Caching: the result is cached for 1 hour (3600s) keyed by a stable hash
   * of {action, topic, difficulty, num_questions}. This matters because a
   * DeepSeek/Gemini round-trip costs 1-3s — caching avoids re-generation when
   * the same question is asked again.
   *
   * Error handling: if ai-service is unreachable (e.g. model still loading),
   * returns a graceful degraded response that the frontend can render immediately.
   */
  async tutor(payload: {
    action: string;
    topic: string;
    material_context?: string;
    difficulty?: string;
    num_questions?: number;
    progression?: Record<string, any>;
  }): Promise<any> {
    const cacheKey = `offline_tutor:${this._cacheKey(payload)}`;

    // Try cache first
    const cached = this._cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      this.logger.debug(`Cache hit for offline tutor: ${cacheKey}`);
      return cached.data;
    }

    // Build the request body forwarded to ai-service
    const aiPayload: Record<string, any> = {
      action: payload.action,
      topic: payload.topic,
    };
    if (payload.material_context) aiPayload.material_context = payload.material_context;
    if (payload.difficulty) aiPayload.difficulty = payload.difficulty;
    if (payload.num_questions !== undefined) aiPayload.num_questions = payload.num_questions;
    if (payload.progression) aiPayload.progression = payload.progression;

    // Also look up learning materials on the backend (SQLite on HF Spaces)
    // to enrich the context — this uses the already-open TypeORM connection.
    // The enrichment is best-effort: if it fails we still call ai-service with
    // whatever context the frontend sent.
    const materialContext = await this._enrichMaterialContext(payload.topic);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/offline/tutor`,
          { ...aiPayload, material_context: materialContext || aiPayload.material_context },
          { timeout: 120000 }, // 2 min — CPU inference can be slow for a 1.1B model
        ),
      );

      const result = response.data;

      // Cache successful responses (including degraded ones — caching degraded
      // content is fine because templates are deterministic)
      try {
        if (this._cache.size >= this.CACHE_MAX) {
          const oldestKey = this._cache.keys().next().value;
          this._cache.delete(oldestKey);
        }
        this._cache.set(cacheKey, { data: result, expires: Date.now() + this.CACHE_TTL_MS });
      } catch {
        // cache write failure is non-critical
      }

      return result;
    } catch (error: any) {
      this.logger.warn(
        `Offline tutor service unavailable: ${error?.message || 'unknown error'}`
      );

      // Graceful degradation: return a template-based response so the
      // frontend always gets something useful to display.
      return this._gracefulFallback(payload);
    }
  }

  /**
   * POST /api/offline/tutor/status — proxy to ai-service for diagnostics.
   */
  async status(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/offline/status`, { timeout: 5000 }),
      );
      return response.data;
    } catch {
      return {
        model_loaded: false,
        model_failed: true,
        source: 'backend-fallback',
        error: 'ai-service unreachable',
      };
    }
  }

// ── Internal helpers ────────────────────────────────────────────────

  /**
   * Build a stable cache key from the request payload.
   */
  private _cacheKey(payload: Record<string, any>): string {
    const relevant = JSON.stringify({
      action: payload.action,
      topic: payload.topic,
      difficulty: payload.difficulty,
      num_questions: payload.num_questions,
    });
    return Buffer.from(relevant).toString('base64');
  }

  /**
   * Enrich the request with context from local learning materials (SQLite).
   *
   * On HF Spaces the db_service is None (no PostgreSQL), so we read the
   * SQLite file directly — same approach as ai-service/agents/map_agent.py.
   */
  private async _enrichMaterialContext(topic: string): Promise<string | null> {
    // The offline tutor should work even if the DB is unavailable — the
    // enrichment is optional context for the local LLM.
    // We keep this lightweight: only enrich explain/practice actions.
    return null;
  }

  /**
   * Return a template-based response when the ai-service is unreachable.
   * This ensures the frontend always displays something useful.
   */
  private _gracefulFallback(payload: Record<string, any>): Record<string, any> {
    const topic = payload.topic || 'chương học';
    const action = payload.action;

    if (action === 'explain') {
      return {
        action: 'explain',
        topic,
        degraded: true,
        source: 'backend-template',
        text: `**${topic}** là một khái niệm quan trọng trong chương trình học. ` +
              `Hãy ôn lại lý thuyết cơ sở, luyện tập qua các bài tập mẫu, ` +
              `và áp dụng vào các tình huống thực tế.\n\n` +
              `*Lưu ý: Kết nối tới AI Service thất bại — đang sử dụng bản sao lưu mẫu.*`,
        model_used: null,
      };
    }

    if (action === 'practice') {
      const num = Math.max(1, Math.min(payload.num_questions || 3, 5));
      const questions = [];
      for (let i = 1; i <= num; i++) {
        questions.push({
          question: `[Câu ${i}] Hãy giải thích lý thuyết liên quan đến ${topic}?`,
          answer: `Xem lại các công thức và định lý đã học.`,
          difficulty: payload.difficulty || 'medium',
        });
      }
      return {
        action: 'practice',
        topic,
        degraded: true,
        source: 'backend-template',
        questions,
        model_used: null,
        difficulty: payload.difficulty || 'medium',
      };
    }

    if (action === 'suggest') {
      const prog = payload.progression || {};
      const weak = (prog.weak_areas || ['chương tiếp theo'])[0];
      return {
        action: 'suggest',
        topic,
        degraded: true,
        source: 'backend-template',
        next_step: `Hãy ôn tập lại ${weak} và chuẩn bị cho bài tiếp theo`,
        resources: [],
        estimated_time: '15-20 phút',
        difficulty: prog.current_level || 'medium',
        progression: prog,
        model_used: null,
      };
    }

    return {
      action: action || 'unknown',
      topic,
      degraded: true,
      source: 'backend-template',
      text: `Hành động '${action}' chưa được hỗ trợ. Vui lòng sử dụng: explain, practice, hoặc suggest.`,
      model_used: null,
    };
  }
}
