import { Test, TestingModule } from '@nestjs/testing';
import { AIService } from './ai.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';
import { ChatHistory } from './entities/chat-history.entity';
import { Repository } from 'typeorm';

describe('AIService', () => {
  let service: AIService;
  let materialRepo: Repository<LearningMaterial>;
  let locationRepo: Repository<Location>;
  let historyRepo: Repository<ChatHistory>;

  const mockMaterialRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLocationRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHistoryRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://ai-service:8000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(LearningMaterial),
          useValue: mockMaterialRepo,
        },
        {
          provide: getRepositoryToken(Location),
          useValue: mockLocationRepo,
        },
        {
          provide: getRepositoryToken(ChatHistory),
          useValue: mockHistoryRepo,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    materialRepo = module.get<Repository<LearningMaterial>>(getRepositoryToken(LearningMaterial));
    locationRepo = module.get<Repository<Location>>(getRepositoryToken(Location));
    historyRepo = module.get<Repository<ChatHistory>>(getRepositoryToken(ChatHistory));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should search learning materials and locations', async () => {
      jest.spyOn(materialRepo, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);
      jest.spyOn(locationRepo, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.search('test query');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
    });
  });

  describe('getUserHistory', () => {
    it('should return user chat history', async () => {
      jest.spyOn(historyRepo, 'find').mockResolvedValue([]);

      const result = await service.getUserHistory('user-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('predictCareerPath', () => {
    it('should return career predictions', async () => {
      jest.spyOn(mockHttpService, 'post').mockReturnValue({
        toPromise: () => Promise.resolve({ data: { top_careers: [] } }),
      } as any);

      const result = await service.predictCareerPath({});

      expect(Array.isArray(result)).toBe(true);
    });
  });
});