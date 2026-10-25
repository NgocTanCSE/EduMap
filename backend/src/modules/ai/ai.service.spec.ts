import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AIService } from './ai.service';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'LearningMaterialRepository', useValue: {} },
        { provide: 'LocationRepository', useValue: {} },
        { provide: 'ChatHistoryRepository', useValue: {} },
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
    });

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
});
