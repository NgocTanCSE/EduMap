import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { MapService } from './map.service';
import { MapPoint } from './entities/map-point.entity';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

jest.mock('rxjs');

describe('MapService', () => {
  let service: MapService;
  let repo: Repository<MapPoint>;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapService,
        {
          provide: getRepositoryToken(MapPoint),
          useValue: {
            createQueryBuilder: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://127.0.0.1:8000'),
          },
        },
      ],
    }).compile();

    service = module.get<MapService>(MapService);
    repo = module.get<Repository<MapPoint>>(getRepositoryToken(MapPoint));
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllPois', () => {
    it('should return all POIs without bounds', async () => {
      const mockPoints = [
        { id: 'mp-1', name: 'Point A', location: { type: 'Point', coordinates: [106.7, 10.8] }, type_id: 1, description: 'University' },
        { id: 'mp-2', name: 'Point B', location: { type: 'Point', coordinates: [106.71, 10.81] }, type_id: 3, description: 'Library' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPoints),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAllPois();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    it('should filter POIs by bounds when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAllPois({
        minLat: 10.0,
        maxLat: 11.0,
        minLng: 106.0,
        maxLng: 107.0,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('findPoisByCategory', () => {
    it('should return POIs matching category', async () => {
      const mockPoints = [
        { id: 'mp-1', name: 'Uni A', location: { type: 'Point', coordinates: [106.7, 10.8] }, type_id: 1, description: 'university' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPoints),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findPoisByCategory('university');

      expect(result).toBeDefined();
    });

    it('should return POIs by description when type_id not in map', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findPoisByCategory('cafe');

      expect(result).toBeDefined();
    });
  });

  describe('getCategories', () => {
    it('should return list of available categories', async () => {
      const result = await service.getCategories();

      expect(result).toBeInstanceOf(Array);
      expect(result).toContain('university');
      expect(result).toContain('cafe');
    });
  });

  describe('createPoi', () => {
    it('should create a new POI', async () => {
      const mockPoint = {
        id: 'mp-1',
        name: 'New Cafe',
        description: 'A nice cafe',
        address: '123 Street',
        type_id: 8,
        location: { type: 'Point', coordinates: [106.7, 10.8] },
        status: 'active',
      };

      jest.spyOn(repo, 'create').mockReturnValue(mockPoint as MapPoint);
      jest.spyOn(repo, 'save').mockResolvedValue(mockPoint as MapPoint);

      const result = await service.createPoi({
        name: 'New Cafe',
        description: 'A nice cafe',
        address: '123 Street',
        category: 'cafe',
        lat: 10.8,
        lng: 106.7,
      });

      expect(result).toEqual(mockPoint);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('analyzeWithAI', () => {
    it('should call AI service and return analysis', async () => {
      const mockPois = [
        { id: 'mp-1', name: 'Spot A', category: 'university', lat: 10.8, lng: 106.7 },
      ];

      jest.spyOn(service as any, 'findAllPois').mockResolvedValue(mockPois);

      const mockAxiosResponse = {
        data: {
          ai_analysis: {
            summary: 'Test summary',
            density_score: 7.5,
            recommendations: [],
          },
        },
      };

      (httpService.post as jest.Mock).mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          toPromise: jest.fn().mockResolvedValue(mockAxiosResponse),
        }),
      });

      const result = await service.analyzeWithAI('test city');

      expect(result).toBeDefined();
      expect(result.summary).toBe('Test summary');
    });
  });
});
