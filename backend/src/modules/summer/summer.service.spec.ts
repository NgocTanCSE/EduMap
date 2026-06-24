import { Test, TestingModule } from '@nestjs/testing';
import { SummerService } from './summer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SummerCampaign } from './entities/summer.entity';
import { Repository } from 'typeorm';

describe('SummerService', () => {
  let service: SummerService;
  let campaignRepo: Repository<SummerCampaign>;

  const mockCampaignRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummerService,
        {
          provide: getRepositoryToken(SummerCampaign),
          useValue: mockCampaignRepo,
        },
      ],
    }).compile();

    service = module.get<SummerService>(SummerService);
    campaignRepo = module.get<Repository<SummerCampaign>>(getRepositoryToken(SummerCampaign));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCampaigns', () => {
    it('should return all summer campaigns', async () => {
      jest.spyOn(campaignRepo, 'find').mockResolvedValue([]);

      const result = await service.getAllCampaigns();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createCampaign', () => {
    it('should create a summer campaign', async () => {
      const mockCampaign = { id: 'campaign-1', name: 'Summer 2024', year: 2024 };
      jest.spyOn(campaignRepo, 'create').mockReturnValue(mockCampaign as any);
      jest.spyOn(campaignRepo, 'save').mockResolvedValue(mockCampaign as any);

      const result = await service.createCampaign({ name: 'Summer 2024', year: 2024 });

      expect(mockCampaignRepo.create).toHaveBeenCalled();
    });
  });

  describe('registerForCampaign', () => {
    it('should register user for campaign', async () => {
      const mockCampaign = { id: 'campaign-1', name: 'Summer 2024' };
      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as any);

      const result = await service.registerForCampaign('user-1', 'campaign-1', {});

      expect(result).toHaveProperty('success', true);
    });
  });
});