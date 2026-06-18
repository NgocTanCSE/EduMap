import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StemService } from './stem.service';
import { StemLab } from './entities/stem.entity';
import { Repository } from 'typeorm';

describe('StemService', () => {
  let service: StemService;
  let repo: Repository<StemLab>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StemService,
        {
          provide: getRepositoryToken(StemLab),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StemService>(StemService);
    repo = module.get<Repository<StemLab>>(getRepositoryToken(StemLab));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLabs', () => {
    it('should return array of stem labs', async () => {
      const mockLabs = [
        { id: 'lab-1', name: 'Physics Lab', booking_available: true },
        { id: 'lab-2', name: 'Chemistry Lab', booking_available: true },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockLabs as StemLab[]);

      const result = await service.getLabs();

      expect(result).toEqual(mockLabs);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('createLab', () => {
    it('should create new stem lab', async () => {
      const mockLab = { id: 'lab-1', name: 'New Lab', booking_available: true };
      jest.spyOn(repo, 'create').mockReturnValue(mockLab as StemLab);
      jest.spyOn(repo, 'save').mockResolvedValue(mockLab as StemLab);

      const result = await service.createLab({
        name: 'New Lab',
        description: 'Lab description',
        longitude: 107.1825,
        latitude: 10.9567,
      });

      expect(result).toEqual(mockLab);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getLabById', () => {
    it('should return lab when found', async () => {
      const mockLab = { id: 'lab-1', name: 'Physics Lab', booking_available: true };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockLab as StemLab);

      const result = await service.getLabById('lab-1');

      expect(result).toEqual(mockLab);
    });

    it('should throw error when lab not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getLabById('nonexistent')).rejects.toThrow();
    });
  });
});
