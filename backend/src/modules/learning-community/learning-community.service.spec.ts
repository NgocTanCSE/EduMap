import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LearningCommunityService } from './learning-community.service';
import { LearningSpot } from './entities/learning-spot.entity';
import { Repository } from 'typeorm';

describe('LearningCommunityService', () => {
  let service: LearningCommunityService;
  let repo: Repository<LearningSpot>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningCommunityService,
        {
          provide: getRepositoryToken(LearningSpot),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LearningCommunityService>(LearningCommunityService);
    repo = module.get<Repository<LearningSpot>>(getRepositoryToken(LearningSpot));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSpot', () => {
    it('should create a new learning spot', async () => {
      const mockSpot = {
        id: 'spot-1',
        name: 'Library Cafe',
        location: { type: 'Point', coordinates: [106.7, 10.8] },
        type: 'cafe',
        has_wifi: true,
        has_power_outlets: true,
        total_capacity: 50,
        rating_avg: 5.0,
      };

      jest.spyOn(repo, 'create').mockReturnValue(mockSpot as LearningSpot);
      jest.spyOn(repo, 'save').mockResolvedValue(mockSpot as LearningSpot);

      const result = await service.createSpot({
        name: 'Library Cafe',
        latitude: '10.8',
        longitude: '106.7',
        type: 'cafe',
      });

      expect(result).toEqual(mockSpot);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when name is missing', async () => {
      await expect(
        service.createSpot({ latitude: '10.8', longitude: '106.7' }),
      ).rejects.toThrow();
    });
  });

  describe('getNearbySpots', () => {
    it('should return nearby spots within default radius', async () => {
      const mockSpots = [
        { id: 'spot-1', name: 'Nearby Cafe', location: { type: 'Point', coordinates: [106.7, 10.8] }, total_capacity: 50 },
        { id: 'spot-2', name: 'Nearby Library', location: { type: 'Point', coordinates: [106.71, 10.81] }, total_capacity: 30 },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSpots as LearningSpot[]),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getNearbySpots(10.8, 106.7);

      expect(result).toEqual(mockSpots);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('spot');
    });

    it('should use custom radius when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await service.getNearbySpots(10.8, 106.7, 1000);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('checkAvailability', () => {
    it('should return availability info for an existing spot', async () => {
      const mockSpot = {
        id: 'spot-1',
        name: 'Library Cafe',
        total_capacity: 100,
      };

      jest.spyOn(repo, 'findOne').mockResolvedValue(mockSpot as LearningSpot);

      const result = await service.checkAvailability('spot-1');

      expect(result).toBeDefined();
      expect(result.spot_id).toBe('spot-1');
      expect(result.total_capacity).toBe(100);
      expect(result.available_seats).toBeGreaterThanOrEqual(0);
    });

    it('should throw NotFoundException when spot does not exist', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.checkAvailability('non-existent')).rejects.toThrow();
    });
  });
});
