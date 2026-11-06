import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class OfflineTutorService {
    private readonly logger = new Logger(OfflineTutorService.name);
    private readonly aiServiceUrl: string;
    private readonly _cache = new Map<string, {
        data: any;
        expires: number;
    }>();
    private readonly CACHE_TTL_MS = 60 * 60 * 1000;
    private readonly CACHE_MAX = 100;
    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
        this.aiServiceUrl =
            this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
    }
    async tutor(payload: {
        action: string;
        topic: string;
        material_context?: string;
        difficulty?: string;
        num_questions?: number;
        progression?: Record<string, any>;
    }): Promise<any> {
        const cacheKey = `offline_tutor:${this._cacheKey(payload)}`;
        const cached = this._cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            this.logger.debug(`Cache hit for offline tutor: ${cacheKey}`);
            return cached.data;
        }
        const aiPayload: Record<string, any> = {
            action: payload.action,
            topic: payload.topic,
        };
        if (payload.material_context)
            aiPayload.material_context = payload.material_context;
        if (payload.difficulty)
            aiPayload.difficulty = payload.difficulty;
        if (payload.num_questions !== undefined)
            aiPayload.num_questions = payload.num_questions;
        if (payload.progression)
            aiPayload.progression = payload.progression;
        const materialContext = await this._enrichMaterialContext(payload.topic);
        try {
            const response = await firstValueFrom(this.httpService.post(`${this.aiServiceUrl}/api/offline/tutor`, { ...aiPayload, material_context: materialContext || aiPayload.material_context }, { timeout: 120000 }));
            const result = response.data;
            try {
                if (this._cache.size >= this.CACHE_MAX) {
                    const oldestKey = this._cache.keys().next().value;
                    this._cache.delete(oldestKey);
                }
                this._cache.set(cacheKey, { data: result, expires: Date.now() + this.CACHE_TTL_MS });
            }
            catch {
            }
            return result;
        }
        catch (error: any) {
            this.logger.warn(`Offline tutor service unavailable: ${error?.message || 'unknown error'}`);
            return this._gracefulFallback(payload);
        }
    }
    async status(): Promise<any> {
        try {
            const response = await firstValueFrom(this.httpService.get(`${this.aiServiceUrl}/api/offline/status`, { timeout: 5000 }));
            return response.data;
        }
        catch {
            return {
                model_loaded: false,
                model_failed: true,
                source: 'backend-fallback',
                error: 'ai-service unreachable',
            };
        }
    }
    private _cacheKey(payload: Record<string, any>): string {
        const relevant = JSON.stringify({
            action: payload.action,
            topic: payload.topic,
            difficulty: payload.difficulty,
            num_questions: payload.num_questions,
        });
        return Buffer.from(relevant).toString('base64');
    }
    private async _enrichMaterialContext(topic: string): Promise<string | null> {
        return null;
    }
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
