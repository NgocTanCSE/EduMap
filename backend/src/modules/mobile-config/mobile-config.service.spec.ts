import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MobileConfigService } from './mobile-config.service';
import { MobileUnit } from './entities/mobile.entity';
import { Repository } from 'typeorm';

describe('MobileConfigService', () => {
  let service: MobileConfigService;
  let repo: Repository<MobileUnit>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileConfigService,
        {
          provide: getRepositoryToken(MobileUnit),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MobileConfigService>(MobileConfigService);
    repo = module.get<Repository<MobileUnit>>(getRepositoryToken(MobileUnit));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUnits', () => {
    it('should return array of mobile units', async () => {
      const mockUnits = [
        { id: 'unit-1', name: 'Mobile Library', type: 'library' },
        { id: 'unit-2', name: 'Mobile Classroom', type: 'classroom' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockUnits as MobileUnit[]);

      const result = await service.getUnits();

      expect(result).toEqual(mockUnits);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('createUnit', () => {
    it('should create new mobile unit', async () => {
      const mockUnit = { id: 'unit-1', name: 'New Unit', type: 'library' };
      jest.spyOn(repo, 'create').mockReturnValue(mockUnit as MobileUnit);
      jest.spyOn(repo, 'save').mockResolvedValue(mockUnit as MobileUnit);

      const result = await service.createUnit({
        name: 'New Unit',
        description: 'Unit description',
        type: 'library',
        longitude: 107.1825,
        latitude: 10.9567,
      });

      expect(result).toEqual(mockUnit);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getUnitById', () => {
    it('should return unit when found', async () => {
      const mockUnit = { id: 'unit-1', name: 'Mobile Library', type: 'library' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockUnit as MobileUnit);

      const result = await service.getUnitById('unit-1');

      expect(result).toEqual(mockUnit);
    });

    it('should throw error when unit not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getUnitById('nonexistent')).rejects.toThrow();
    });
  });
});
