import { Test, TestingModule } from '@nestjs/testing';
import { LearningCommunityService } from './learning-community.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LearningSpot } from './entities/learning-spot.entity';
import { Repository } from 'typeorm';

describe('LearningCommunityService', () => {
  let service: LearningCommunityService;
  let spotRepo: Repository<LearningSpot>;

  const mockSpotRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningCommunityService,
        {
          provide: getRepositoryToken(LearningSpot),
          useValue: mockSpotRepo,
        },
      ],
    }).compile();

    service = module.get<LearningCommunityService>(LearningCommunityService);
    spotRepo = module.get<Repository<LearningSpot>>(getRepositoryToken(LearningSpot));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSpot', () => {
    it('should create a learning spot', async () => {
      const mockSpot = {
        id: 'spot-1',
        name: 'Test Study Spot',
        location: { type: 'Point', coordinates: [106, 10] },
        total_capacity: 50,
      };
      jest.spyOn(spotRepo, 'create').mockReturnValue(mockSpot as any);
      jest.spyOn(spotRepo, 'save').mockResolvedValue(mockSpot as any);

      const result = await service.createSpot({
        name: 'Test Study Spot',
        latitude: 10.0,
        longitude: 106.0,
      });

      expect(mockSpotRepo.create).toHaveBeenCalled();
      expect(mockSpotRepo.save).toHaveBeenCalled();
    });

    it('should throw error for missing required fields', async () => {
      await expect(service.createSpot({ name: 'Test' })).rejects.toThrow('cung cấp đầy đủ');
    });
  });

  describe('getNearbySpots', () => {
    it('should return nearby spots', async () => {
      jest.spyOn(spotRepo, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getNearbySpots(10.0, 106.0, 5000);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('checkAvailability', () => {
    it('should return availability info', async () => {
      const mockSpot = {
        id: 'spot-1',
        name: 'Test Spot',
        total_capacity: 50,
      };
      jest.spyOn(spotRepo, 'findOne').mockResolvedValue(mockSpot as any);

      const result = await service.checkAvailability('spot-1');

      expect(result).toHaveProperty('spot_id');
      expect(result).toHaveProperty('available_seats');
      expect(result).toHaveProperty('status');
    });
  });
});