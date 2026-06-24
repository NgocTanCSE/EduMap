import { Test, TestingModule } from '@nestjs/testing';
import { MapService } from './map.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

describe('MapService', () => {
  let service: MapService;
  let mapPointRepo: Repository<MapPoint>;
  let locationRepo: Repository<Location>;

  const mockMapPointRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockLocationRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://ai-service:8000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapService,
        {
          provide: getRepositoryToken(MapPoint),
          useValue: mockMapPointRepo,
        },
        {
          provide: getRepositoryToken(Location),
          useValue: mockLocationRepo,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MapService>(MapService);
    mapPointRepo = module.get<Repository<MapPoint>>(getRepositoryToken(MapPoint));
    locationRepo = module.get<Repository<Location>>(getRepositoryToken(Location));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllPois', () => {
    it('should return all points of interest', async () => {
      jest.spyOn(mapPointRepo, 'createQueryBuilder').mockReturnValue({
        getMany: jest.fn().mockResolvedValue([]),
      } as any);
      jest.spyOn(locationRepo, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.findAllPois();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return list of categories', async () => {
      const result = await service.getCategories();
      expect(result).toContain('university');
      expect(result).toContain('school');
      expect(result).toContain('library');
    });
  });

  describe('createPoi', () => {
    it('should create a new POI', async () => {
      const mockPoi = {
        id: 'test-id',
        name: 'Test Location',
        category: 'school',
        location: { type: 'Point', coordinates: [106.0, 10.0] },
      };
      jest.spyOn(mockMapPointRepo, 'create').mockReturnValue(mockPoi as any);
      jest.spyOn(mockMapPointRepo, 'save').mockResolvedValue(mockPoi as any);

      const result = await service.createPoi({
        name: 'Test Location',
        category: 'school',
        lng: 106.0,
        lat: 10.0,
      });

      expect(mockMapPointRepo.create).toHaveBeenCalled();
      expect(mockMapPointRepo.save).toHaveBeenCalled();
    });
  });
});