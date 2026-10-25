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
});
