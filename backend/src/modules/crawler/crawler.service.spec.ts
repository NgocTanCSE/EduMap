import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AIService } from '../ai/ai.service';
import { CrawlerService } from './crawler.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { Repository } from 'typeorm';
import { of } from 'rxjs';

describe('CrawlerService', () => {
  let service: CrawlerService;
  let httpService: HttpService;
  let mapRepo: Repository<MapPoint>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AIService,
          useValue: {},
        },
        {
          provide: getRepositoryToken(MapPoint),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orWhere: jest.fn().mockReturnThis(),
              setParameters: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            }),
            create: jest.fn(),
            save: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<CrawlerService>(CrawlerService);
    httpService = module.get<HttpService>(HttpService);
    mapRepo = module.get<Repository<MapPoint>>(getRepositoryToken(MapPoint));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerCrawl', () => {
    it('should return error when crawl is already running', async () => {
      (service as any).crawlStatus.isRunning = true;

      const result = await service.triggerCrawl('map');

      expect(result.success).toBe(false);
      expect(result.message).toBe('A crawl process is already running');
    });

    it('should return error for invalid crawl type', async () => {
      (service as any).crawlStatus.isRunning = false;

      const result = await service.triggerCrawl('invalid_type');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid crawl type');
    });
  });

  describe('getCrawlStatus', () => {
    it('should return current crawl status', async () => {
      const result = await service.getCrawlStatus();

      expect(result).toBeDefined();
      expect(result.isRunning).toBe(false);
      expect(result.totalCrawled).toBe(0);
    });
  });

  describe('getCrawlHistory', () => {
    it('should return crawl history', async () => {
      const result = await service.getCrawlHistory();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCrawlStats', () => {
    it('should return crawl statistics', async () => {
      const result = await service.getCrawlStats();

      expect(result).toBeDefined();
      expect(result.totalCrawls).toBeDefined();
      expect(result.successfulCrawls).toBeDefined();
    });
  });

  describe('getCrawlTypes', () => {
    it('should return list of valid crawl types', async () => {
      const result = await service.getCrawlTypes();

      expect(result).toContain('map');
      expect(result).toContain('all');
    });
  });

  describe('crawlDNTUSurroundings', () => {
    it('should return success with added count when Overpass API responds', async () => {
      const mockResponse = {
        data: {
          elements: [
            { tags: { name: 'Test Cafe', amenity: 'cafe' }, lat: 10.988, lon: 106.855 },
          ],
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(of(mockResponse));
      jest.spyOn(mapRepo, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await (service as any).crawlDNTUSurroundings();

      expect(result.success).toBe(true);
      expect(result.added).toBeGreaterThanOrEqual(0);
    });
  });
});
