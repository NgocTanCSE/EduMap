import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SummerCampaignService } from './summer.service';
import { SummerCampaign } from './entities/summer.entity';
import { SummerRegistration } from './entities/summer-registration.entity';
import { SummerActivity } from './entities/summer-activity.entity';
import { Repository } from 'typeorm';

describe('SummerCampaignService', () => {
  let service: SummerCampaignService;
  let campaignRepo: Repository<SummerCampaign>;
  let registrationRepo: Repository<SummerRegistration>;
  let activityRepo: Repository<SummerActivity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummerCampaignService,
        {
          provide: getRepositoryToken(SummerCampaign),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SummerRegistration),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SummerActivity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SummerCampaignService>(SummerCampaignService);
    campaignRepo = module.get<Repository<SummerCampaign>>(getRepositoryToken(SummerCampaign));
    registrationRepo = module.get<Repository<SummerRegistration>>(getRepositoryToken(SummerRegistration));
    activityRepo = module.get<Repository<SummerActivity>>(getRepositoryToken(SummerActivity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCampaign', () => {
    it('should create a new campaign', async () => {
      const mockCampaign = {
        id: 'camp-1',
        name: 'Green Summer 2024',
        year: 2024,
        location: 'Hanoi',
        status: 'active',
        description: 'Summer campaign',
      };

      jest.spyOn(campaignRepo, 'create').mockReturnValue(mockCampaign as SummerCampaign);
      jest.spyOn(campaignRepo, 'save').mockResolvedValue(mockCampaign as SummerCampaign);

      const result = await service.createCampaign({
        name: 'Green Summer 2024',
        year: 2024,
        location: 'Hanoi',
        description: 'Summer campaign',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Green Summer 2024');
      expect(campaignRepo.create).toHaveBeenCalled();
      expect(campaignRepo.save).toHaveBeenCalled();
    });
  });

  describe('getCampaigns', () => {
    it('should return all campaigns', async () => {
      const mockCampaigns = [
        { id: 'camp-1', name: 'Campaign A', year: 2024 },
        { id: 'camp-2', name: 'Campaign B', year: 2023 },
      ];

      jest.spyOn(campaignRepo, 'find').mockResolvedValue(mockCampaigns as SummerCampaign[]);

      const result = await service.getCampaigns();

      expect(result).toEqual(mockCampaigns);
      expect(campaignRepo.find).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('addActivity', () => {
    it('should add activity to campaign', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Campaign A', status: 'active' };
      const mockActivity = {
        id: 'act-1',
        campaign_id: 'camp-1',
        title: 'Clean Park',
        description: 'Cleaning the park',
        volunteer_count: 20,
        hours_spent: 4.0,
        date: '2024-06-15',
        status: 'completed',
      };

      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as SummerCampaign);
      jest.spyOn(activityRepo, 'create').mockReturnValue(mockActivity as SummerActivity);
      jest.spyOn(activityRepo, 'save').mockResolvedValue(mockActivity as SummerActivity);

      const result = await service.addActivity('camp-1', {
        title: 'Clean Park',
        description: 'Cleaning the park',
        volunteer_count: 20,
        hours_spent: 4.0,
        date: '2024-06-15',
      });

      expect(result).toBeDefined();
      expect(result.campaign_id).toBe('camp-1');
    });

    it('should throw NotFoundException when campaign does not exist', async () => {
      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.addActivity('non-existent', { title: 'Activity' }),
      ).rejects.toThrow();
    });
  });

  describe('getDailyReport', () => {
    it('should return daily report for a campaign', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Campaign A', location: 'Hanoi' };
      const mockActivities = [
        { id: 'act-1', campaign_id: 'camp-1', title: 'Clean Park', hours_spent: 4, volunteer_count: 20, status: 'completed', date: '2024-06-15' },
      ];

      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as SummerCampaign);
      jest.spyOn(activityRepo, 'find').mockResolvedValue(mockActivities as SummerActivity[]);
      jest.spyOn(registrationRepo, 'count').mockResolvedValue(50);

      const result = await service.getDailyReport('camp-1', '2024-06-15');

      expect(result).toBeDefined();
      expect(result.campaign_id).toBe('camp-1');
      expect(result.activities.length).toBe(1);
      expect(result.total_volunteers_approved).toBe(50);
    });

    it('should throw NotFoundException when campaign does not exist', async () => {
      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.getDailyReport('non-existent', '2024-06-15'),
      ).rejects.toThrow();
    });
  });

  describe('registerVolunteer', () => {
    it('should register a volunteer to a campaign', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Campaign A', status: 'active' };
      const mockRegistration = {
        id: 'reg-1',
        user_id: 'user-1',
        campaign_id: 'camp-1',
        status: 'pending',
        created_at: new Date(),
      };

      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as SummerCampaign);
      jest.spyOn(registrationRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(registrationRepo, 'create').mockReturnValue(mockRegistration as SummerRegistration);
      jest.spyOn(registrationRepo, 'save').mockResolvedValue(mockRegistration as SummerRegistration);

      const result = await service.registerVolunteer('camp-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(registrationRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when campaign is not active', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Campaign A', status: 'completed' };

      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as SummerCampaign);

      await expect(
        service.registerVolunteer('camp-1', 'user-1'),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException when already registered', async () => {
      const mockCampaign = { id: 'camp-1', name: 'Campaign A', status: 'active' };
      const mockExisting = { id: 'reg-1', user_id: 'user-1', campaign_id: 'camp-1' };

      jest.spyOn(campaignRepo, 'findOne').mockResolvedValue(mockCampaign as SummerCampaign);
      jest.spyOn(registrationRepo, 'findOne').mockResolvedValue(mockExisting as SummerRegistration);

      await expect(
        service.registerVolunteer('camp-1', 'user-1'),
      ).rejects.toThrow();
    });
  });

  describe('updateRegistrationStatus', () => {
    it('should update registration status to approved', async () => {
      const mockReg = {
        id: 'reg-1',
        user_id: 'user-1',
        campaign_id: 'camp-1',
        status: 'pending',
      };

      jest.spyOn(registrationRepo, 'findOne').mockResolvedValue(mockReg as SummerRegistration);
      jest.spyOn(registrationRepo, 'save').mockResolvedValue({ ...mockReg, status: 'approved' } as SummerRegistration);

      const result = await service.updateRegistrationStatus('reg-1', 'approved');

      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException when registration not found', async () => {
      jest.spyOn(registrationRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateRegistrationStatus('non-existent', 'approved'),
      ).rejects.toThrow();
    });
  });
});
