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
});
