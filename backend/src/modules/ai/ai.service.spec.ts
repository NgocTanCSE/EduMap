import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AIService } from './ai.service';
import { SessionMemoryService } from './session-memory.service';

describe('AIService', () => {
  let service: AIService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
      axiosRef: {
        post: jest.fn(),
      },
    };
    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://127.0.0.1:8000'),
    };
    const mockSessionMemory = {
      getOrCreateSession: jest.fn().mockReturnValue({
        id: 'sess_test',
        userId: 'user-123',
        messages: [],
        topics: [],
        preferredContext: {},
      }),
      getRecentHistory: jest.fn().mockReturnValue([]),
      getSessionContext: jest.fn().mockReturnValue({ topics: [], preferredContext: {} }),
      addTurn: jest.fn(),
      endSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SessionMemoryService, useValue: mockSessionMemory },
        { provide: 'LearningMaterialRepository', useValue: {} },
        { provide: 'LocationRepository', useValue: {} },
        { provide: 'ChatHistoryRepository', useValue: {} },
        { provide: 'QueryLogRepository', useValue: {} },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    httpService = module.get(HttpService);
  });

  describe('moderateContent', () => {
    it('should return the moderation result when AI service responds', async () => {
      const mockResult = {
        status: 'Processed via AI Service',
        is_safe: true,
        confidence: 0.95,
        flags: [],
        action_taken: 'APPROVED',
        moderation_message: null,
      };

      httpService.post.mockReturnValue(of({ data: mockResult } as any));

      const result = await service.moderateContent('user-1', 'Bài viết kiểm tra');
      expect(result).toEqual(mockResult);
      expect(result.action_taken).toBe('APPROVED');
    });

    it('should pass through the AI service error detail (not a generic message)', async () => {
      // Simulate the Python AI service returning a 503 with a detailed message
      const aiError = {
        response: {
          status: 503,
          data: {
            detail: 'Hệ thống kiểm duyệt AI đang tạm thời gián đoạn. Gemini: không cấu hình, Cloudflare: tạm thời gián đoạn, HuggingFace: 401.',
          },
        },
      };

      httpService.post.mockReturnValue(throwError(() => aiError));

      await expect(service.moderateContent('user-1', 'test')).rejects.toThrow(
        /Hệ thống kiểm duyệt AI/,
      );
    });

    it('should use generic message only when the AI service sends no detail', async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({ message: 'connect ECONNREFUSED 127.0.0.1:8000' })),
      );

      await expect(service.moderateContent('user-1', 'test')).rejects.toThrow(
        /connect ECONNREFUSED/,
      );
    });
  });

  describe('generateLearningPath', () => {
    it('should pass through degraded (fallback) learning path when AI service is down', async () => {
      // The Python AI service now returns 200 with a template-based fallback
      // instead of raising a 503. The NestJS service must pass this through.
      const degradedResult = {
        target_role: 'Data Scientist',
        total_estimated_months: 5.0,
        steps: [
          { step_number: 1, title: 'Nền tảng cho Data Scientist', estimated_weeks: 4, description: '...' },
          { step_number: 2, title: 'Kỹ năng chuyên ngành', estimated_weeks: 6, description: '...' },
        ],
        degraded: true,
        reason: 'AI unavailable -- template fallback',
      };

      httpService.post.mockReturnValue(of({ data: degradedResult } as any));

      const result = await service.generateLearningPath({
        user_id: 'user-1',
        current_level: 'Beginner',
        target_role: 'Data Scientist',
        time_commitment_hours_per_week: 15,
      });

      expect(result).toEqual(degradedResult);
      expect(result.degraded).toBe(true);
      expect(result.steps.length).toBe(2);
    });

    it('should throw 503 when the AI service is completely unreachable', async () => {
      httpService.post.mockReturnValue(
        throwError(() => ({ message: 'connect ECONNREFUSED 127.0.0.1:8000' })),
      );

      await expect(
        service.generateLearningPath({
          user_id: 'user-1',
          current_level: 'Beginner',
          target_role: 'Developer',
          time_commitment_hours_per_week: 10,
        }),
      ).rejects.toThrow(/tạm thời gián đoạn/);
    });
  });

  describe('chatStream', () => {
    const { PassThrough } = require('stream');

    const createMockRes = () => {
      const mockRes = {
        headersSent: false,
        writable: true,
        write: jest.fn(() => true),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn(),
      } as any;
      // Make status() chainable (res.status(503).json(...))
      mockRes.status.mockReturnValue(mockRes);
      return mockRes;
    };

    const flush = () => new Promise((resolve) => setImmediate(resolve));

    /** Helper: emit SSE chunks then end the mock stream. */
    const emitSse = (stream: any, chunks: string[]) => {
      for (const c of chunks) stream.write(c);
      stream.end();
    };

    beforeEach(() => {
      // Wire up axiosRef.post for chatStream (uses raw axios, not Observable)
      (httpService.axiosRef.post as jest.Mock).mockResolvedValue({
        data: new PassThrough(),
      });
    });

    it('should forward SSE chunks to the client and save accumulated history', async () => {
      const mockStream = new PassThrough();
      (httpService.axiosRef.post as jest.Mock).mockResolvedValue({ data: mockStream });

      const mockHistoryRepo = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockMaterialRepo = { find: jest.fn().mockResolvedValue([]) };
      const mockLocationRepo = { find: jest.fn().mockResolvedValue([]) };
      (service as any).historyRepo = mockHistoryRepo;
      (service as any).materialRepo = mockMaterialRepo;
      (service as any).locationRepo = mockLocationRepo;

      const mockRes = createMockRes();

      // Kick off chatStream — resolves after POST + listener setup
      const promise = service.chatStream('Xin chào', [], {}, 'user-123', mockRes);
      await promise;

      // Simulate SSE chunks from the ai-service
      mockStream.write('data: {"sources": [{"doc_id":"1","title":"Tài liệu 1","snippet":"..."}], "meta": true}\n\n');
      mockStream.write('data: {"token": "Chào", "is_final": false}\n\n');
      mockStream.write('data: {"token": " bạn", "is_final": false}\n\n');
      mockStream.write('data: {"done": true}\n\n');
      mockStream.end();

      // Allow stream 'data' / 'end' events + async history save to flush
      await flush();
      await flush();

      // 1. Raw SSE bytes were forwarded in real time (one write per SSE chunk)
      expect(mockRes.write).toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"sources"'),
      );
      // Tokens arrive as separate SSE chunks — verify each was forwarded
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"token": "Chào"'),
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('" bạn"'),
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"done"'),
      );

      // 2. History was persisted with the FULL accumulated reply
      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          message: 'Xin chào',
          response: 'Chào bạn',
        }),
      );
      expect(mockHistoryRepo.save).toHaveBeenCalledTimes(1);

      // 3. Sources were included in the saved context
      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            sources: expect.arrayContaining([
              expect.objectContaining({ doc_id: '1', title: 'Tài liệu 1' }),
            ]),
          }),
        }),
      );
    });

    // With the increased retry count (7 attempts × 3s backoff), a fully
    // unreachable ai-service takes ~18s before giving up with 503.
    // Jest's default 5s timeout is insufficient — use 30s to accommodate
    // the retry-with-backoff logic tuned for HF Spaces cold-start scenarios.
    it('should return 503 when the ai-service is unreachable', async () => {
      (httpService.axiosRef.post as jest.Mock).mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:8000'),
      );

      const mockRes = createMockRes();

      await service.chatStream('test', [], {}, 'user-123', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'AI streaming service is unavailable.',
        }),
      );
    }, 30000);

    it('should NOT save history when userId is empty', async () => {
      const mockStream = new PassThrough();
      (httpService.axiosRef.post as jest.Mock).mockResolvedValue({ data: mockStream });

      const mockHistoryRepo = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockMaterialRepo = { find: jest.fn().mockResolvedValue([]) };
      const mockLocationRepo = { find: jest.fn().mockResolvedValue([]) };
      (service as any).historyRepo = mockHistoryRepo;
      (service as any).materialRepo = mockMaterialRepo;
      (service as any).locationRepo = mockLocationRepo;

      const mockRes = createMockRes();

      const promise = service.chatStream('test', [], {}, '', mockRes);
      await promise;

      mockStream.write('data: {"token": "Hi", "is_final": false}\n\n');
      mockStream.write('data: {"done": true}\n\n');
      mockStream.end();

      await flush();
      await flush();

      expect(mockHistoryRepo.create).not.toHaveBeenCalled();
      expect(mockHistoryRepo.save).not.toHaveBeenCalled();
    });

    it('should handle cache-hit SSE chunks (single token chunk with done)', async () => {
      const mockStream = new PassThrough();
      (httpService.axiosRef.post as jest.Mock).mockResolvedValue({ data: mockStream });

      const mockHistoryRepo = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockMaterialRepo = { find: jest.fn().mockResolvedValue([]) };
      const mockLocationRepo = { find: jest.fn().mockResolvedValue([]) };
      (service as any).historyRepo = mockHistoryRepo;
      (service as any).materialRepo = mockMaterialRepo;
      (service as any).locationRepo = mockLocationRepo;

      const mockRes = createMockRes();

      const promise = service.chatStream('repeated question', [], {}, 'user-456', mockRes);
      await promise;

      // Cache-hit path: single chunk with sources + token + done
      mockStream.write(
        'data: {"sources": [], "token": "Cached answer", "is_final": true, "done": true}\n\n',
      );
      mockStream.end();

      await flush();
      await flush();

      expect(mockRes.write).toHaveBeenCalled();
      expect(mockHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          message: 'repeated question',
          response: 'Cached answer',
        }),
      );
      expect(mockHistoryRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should call res.end() when the upstream stream errors', async () => {
      const mockStream = new PassThrough();
      (httpService.axiosRef.post as jest.Mock).mockResolvedValue({ data: mockStream });

      const mockRes = createMockRes();

      const promise = service.chatStream('test', [], {}, 'user-123', mockRes);
      await promise;

      mockStream.emit('error', new Error('stream broken'));

      await flush();

      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('Question Gap Report (Idea #17)', () => {
    const mockQueryLogsRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    };

    beforeEach(() => {
      (service as any).queryLogsRepo = mockQueryLogsRepo;
    });

    describe('privacy & anonymisation', () => {
      it('should SHA-256 hash the user_id before logging (never stores raw id)', () => {
        const hash = (service as any)._hashUserId('user-abc-123');
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
        expect(hash).not.toBe('user-abc-123');
        // Deterministic — same input always produces the same hash.
        expect((service as any)._hashUserId('user-abc-123')).toBe(hash);
        // Different inputs → different hashes.
        expect((service as any)._hashUserId('user-xyz-456')).not.toBe(hash);
      });
    });

    describe('_computeQuality', () => {
      it('should score high when many sources and a substantive reply', () => {
        const quality = (service as any)._computeQuality(
          [{ doc_id: '1' }, { doc_id: '2' }, { doc_id: '3' }, { doc_id: '4' }, { doc_id: '5' }],
          'A'.repeat(600),
        );
        expect(quality).toBeGreaterThanOrEqual(0.9);
        expect(quality).toBeLessThanOrEqual(1.0);
      });

      it('should score low when no sources and a short reply', () => {
        const quality = (service as any)._computeQuality([], 'Tôi không biết');
        expect(quality).toBeLessThan(0.3);
      });

      it('should cap quality at 1.0', () => {
        const quality = (service as any)._computeQuality(
          Array.from({ length: 20 }),
          'A'.repeat(2000),
        );
        expect(quality).toBeLessThanOrEqual(1.0);
      });
    });

    describe('_retrievalStatus', () => {
      it('should return success when 3+ sources retrieved', () => {
        expect((service as any)._retrievalStatus([1, 2, 3])).toBe('success');
      });

      it('should return partial when 1-2 sources retrieved', () => {
        expect((service as any)._retrievalStatus([1, 2])).toBe('partial');
        expect((service as any)._retrievalStatus([1])).toBe('partial');
      });

      it('should return failed when no sources retrieved', () => {
        expect((service as any)._retrievalStatus([])).toBe('failed');
      });
    });

    describe('_logQuery', () => {
      it('should fire-and-forget save a hashed query log row', () => {
        jest.clearAllMocks();
        (service as any)._logQuery(
          'user-123',
          'hỏi về học bổng',
          [{ doc_id: '1' }],
          'Đây là câu trả lời chi tiết về học bổng.',
        );
        expect(mockQueryLogsRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userIdHash: expect.any(String),
            queryText: 'hỏi về học bổng',
            retrievedDocCount: 1,
            retrievalStatus: 'partial',
            responseQuality: expect.any(Number),
          }),
        );
        expect(mockQueryLogsRepo.save).toHaveBeenCalledWith(expect.any(Object));
      });

      it('should NOT log when userId is empty (privacy guard)', () => {
        jest.clearAllMocks();
        (service as any)._logQuery('', 'câu hỏi', [], '');
        expect(mockQueryLogsRepo.create).not.toHaveBeenCalled();
      });

      it('should set retrievalStatus to failed when zero sources', () => {
        jest.clearAllMocks();
        (service as any)._logQuery('user-1', 'hỏi không có đáp', [], 'Không rõ');
        expect(mockQueryLogsRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            retrievedDocCount: 0,
            retrievalStatus: 'failed',
          }),
        );
      });
    });

    describe('getQuestionGaps', () => {
      it('should proxy to the ai-service and return the report', async () => {
        const mockReport = {
          status: 'success',
          total_queries: 88,
          clusters: [{ cluster_id: 0, topic: 'học bổng', gap_rate: 0.3, total_queries: 20, gap_count: 6, recommended_docs: ['Tài liệu...'], top_terms: ['học'], representative_query: '...', gap_queries: [] }],
          top_gaps: [],
          summary: 'Báo cáo...',
          privacy: { user_id_hashed: true, hash_algorithm: 'sha256', ttl_days: 30 },
          degraded: false,
          limit_applied: 10000,
          date_range: { start: '2025-01-01', end: '2025-06-01' },
        };
        httpService.get.mockReturnValue(
          of({ data: mockReport } as any),
        );

        const result = await service.getQuestionGaps(5000);
        expect(result).toEqual(mockReport);
        expect(httpService.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/ai/analytics/question-gaps?limit=5000'),
          expect.objectContaining({ timeout: 30000 }),
        );
      });

      it('should return degraded payload when the ai-service is unreachable', async () => {
        httpService.get.mockReturnValue(
          throwError(() => new Error('connect ECONNREFUSED 127.0.0.1:8000')),
        );

        const result = await service.getQuestionGaps();
        expect(result.degraded).toBe(true);
        expect(result.status).toBe('error');
        expect(result.clusters).toEqual([]);
        expect(result.top_gaps).toEqual([]);
        expect(result.summary).toContain('tạm thời không khả dụng');
      });

      it('should cache results for 30 minutes and return cached on repeat calls', async () => {
        const mockReport = { status: 'success', total_queries: 10, clusters: [], top_gaps: [], summary: 'test', degraded: false, privacy: { user_id_hashed: true, hash_algorithm: 'sha256', ttl_days: 30 }, limit_applied: 10000, date_range: { start: null, end: null } };
        httpService.get.mockReturnValue(
          of({ data: mockReport } as any),
        );

        // First call — hits the ai-service.
        const first = await service.getQuestionGaps(100);
        expect(first.cached).toBeFalsy();
        expect(httpService.get).toHaveBeenCalledTimes(1);

        // Second call — should return from cache (no new HTTP call).
        const second = await service.getQuestionGaps(100);
        expect(second.cached).toBe(true);
        expect(httpService.get).toHaveBeenCalledTimes(1); // still 1, not 2
      });
    });
  });
});
