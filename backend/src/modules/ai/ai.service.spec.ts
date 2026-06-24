import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';
import { ChatHistory } from './entities/chat-history.entity';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';

describe('AIService', () => {
  let service: AIService;
  let httpService: HttpService;
  let configService: ConfigService;
  let materialRepo: Repository<LearningMaterial>;
  let locationRepo: Repository<Location>;
  let historyRepo: Repository<ChatHistory>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://127.0.0.1:8000'),
          },
        },
        {
          provide: getRepositoryToken(LearningMaterial),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Location),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ChatHistory),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
    materialRepo = module.get<Repository<LearningMaterial>>(getRepositoryToken(LearningMaterial));
    locationRepo = module.get<Repository<Location>>(getRepositoryToken(Location));
    historyRepo = module.get<Repository<ChatHistory>>(getRepositoryToken(ChatHistory));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserHistory', () => {
    it('should return chat history for a user', async () => {
      const mockHistory = [
        { id: '1', message: 'Hello', response: 'Hi' },
      ] as ChatHistory[];
      jest.spyOn(historyRepo, 'find').mockResolvedValue(mockHistory);

      const result = await service.getUserHistory('user-1');

      expect(result).toEqual(mockHistory);
      expect(historyRepo.find).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      jest.spyOn(historyRepo, 'find').mockRejectedValue(new Error('DB error'));

      const result = await service.getUserHistory('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should return search results with materials and locations', async () => {
      const mockMaterials = [
        { id: '1', title: 'Math 101', description: 'Basic math', type: 'book', subject: 'Math', view_count: 100 },
      ] as LearningMaterial[];
      const mockLocations = [
        { id: '1', name: 'Library', description: 'Study place', address: '123 St' },
      ] as Location[];

      const materialQB = materialRepo.createQueryBuilder as jest.Mock;
      materialQB.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMaterials),
      });

      const locationQB = locationRepo.createQueryBuilder as jest.Mock;
      locationQB.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLocations),
      });

      const result = await service.search('math');

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('predictCareerPath', () => {
    it('should call AI service and return top careers', async () => {
      const mockResponse = {
        data: {
          top_careers: [
            { title: 'Developer', match_score: 90 },
          ],
        },
      };
      (httpService.post as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await service.predictCareerPath({ skills: ['JS', 'TS'] });

      expect(result).toEqual(mockResponse.data.top_careers);
    });

    it('should return fallback careers on error', async () => {
      (httpService.post as jest.Mock).mockReturnValue(throwError(() => new Error('AI offline')));

      const result = await service.predictCareerPath({ skills: ['JS'] });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBe('Fullstack Developer');
    });
  });

  describe('getMarketTrends', () => {
    it('should return trends data', async () => {
      const mockTrends = { trends: ['AI', 'Cloud'] };
      (httpService.get as jest.Mock).mockReturnValue(of({ data: mockTrends }));

      const result = await service.getMarketTrends();

      expect(result).toEqual(mockTrends);
    });

    it('should return offline fallback on error', async () => {
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => new Error('AI offline')));

      const result = await service.getMarketTrends();

      expect(result.status).toBe('offline');
    });
  });

  describe('getAnalyticsStats', () => {
    it('should return analytics stats', async () => {
      const mockStats = {
        historical_data: [{ value: 100 }],
        insights: { average_annual_growth_pct: 5 },
        status: 'success',
      };
      (httpService.get as jest.Mock).mockReturnValue(of({ data: mockStats }));
      jest.spyOn(historyRepo, 'count').mockResolvedValue(42);

      const result = await service.getAnalyticsStats();

      expect(result.success).toBe(true);
      expect(result.data.total_predictions).toBe(42);
    });
  });
});
