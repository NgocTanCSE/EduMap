import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DonateService } from './donate.service';
import { DonationCampaign } from './entities/donation.entity';
import { Repository } from 'typeorm';

describe('DonateService', () => {
  let service: DonateService;
  let repo: Repository<DonationCampaign>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonateService,
        {
          provide: getRepositoryToken(DonationCampaign),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DonateService>(DonateService);
    repo = module.get<Repository<DonationCampaign>>(getRepositoryToken(DonationCampaign));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCampaigns', () => {
    it('should return array of campaigns', async () => {
      const mockCampaigns = [
        { id: 'campaign-1', title: 'Library Fund', status: 'active' },
        { id: 'campaign-2', title: 'Scholarship Fund', status: 'active' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockCampaigns as DonationCampaign[]);

      const result = await service.getCampaigns();

      expect(result).toEqual(mockCampaigns);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getCampaignById', () => {
    it('should return campaign when found', async () => {
      const mockCampaign = { id: 'campaign-1', title: 'Library Fund', status: 'active' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockCampaign as DonationCampaign);

      const result = await service.getCampaignById('campaign-1');

      expect(result).toEqual(mockCampaign);
    });

    it('should throw error when campaign not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getCampaignById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createCampaign', () => {
    it('should create new campaign', async () => {
      const mockCampaign = { id: 'campaign-1', title: 'New Campaign', status: 'active' };
      jest.spyOn(repo, 'create').mockReturnValue(mockCampaign as DonationCampaign);
      jest.spyOn(repo, 'save').mockResolvedValue(mockCampaign as DonationCampaign);

      const result = await service.createCampaign({
        title: 'New Campaign',
        description: 'Campaign description',
        target_amount: 100000000,
        organizer_id: 'user-1',
      });

      expect(result).toEqual(mockCampaign);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
