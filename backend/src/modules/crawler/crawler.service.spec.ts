import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerService, CrawlStatus } from './crawler.service';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { AIService } from '../ai/ai.service';
import { Repository } from 'typeorm';

describe('CrawlerService', () => {
  let service: CrawlerService;
  let mapRepo: Repository<MapPoint>;

  const mockMapRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockAiService = {
    analyzePlace: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: AIService,
          useValue: mockAiService,
        },
        {
          provide: getRepositoryToken(MapPoint),
          useValue: mockMapRepo,
        },
      ],
    }).compile();

    service = module.get<CrawlerService>(CrawlerService);
    mapRepo = module.get<Repository<MapPoint>>(getRepositoryToken(MapPoint));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCrawlStatus', () => {
    it('should return crawl status', async () => {
      const result = await service.getCrawlStatus();

      expect(result).toHaveProperty('isRunning');
      expect(result).toHaveProperty('currentType');
      expect(result).toHaveProperty('totalCrawled');
    });
  });

  describe('getCrawlHistory', () => {
    it('should return crawl history', async () => {
      const result = await service.getCrawlHistory();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('triggerCrawl', () => {
    it('should reject invalid crawl type', async () => {
      const result = await service.triggerCrawl('invalid');

      expect(result.success).toBe(false);
    });

    it('should reject if already running', async () => {
      // Start first crawl
      service.triggerCrawl('map').then(() => {});
      
      // Try another crawl
      const result = await service.triggerCrawl('wifi');

      expect(result.success).toBe(false);
    });
  });

  describe('getCrawlTypes', () => {
    it('should return valid crawl types', async () => {
      const result = await service.getCrawlTypes();

      expect(result).toContain('map');
      expect(result).toContain('wifi');
      expect(result).toContain('schools');
      expect(result).toContain('books');
      expect(result).toContain('green_spaces');
      expect(result).toContain('all');
    });
  });
});