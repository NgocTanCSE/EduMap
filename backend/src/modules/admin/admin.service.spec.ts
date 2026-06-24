import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { DonationCampaign } from '../donate/entities/donation.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Event } from '../events/entities/event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Repository } from 'typeorm';

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: Repository<User>;
  let campaignRepo: Repository<DonationCampaign>;
  let scholarRepo: Repository<Scholarship>;
  let eventRepo: Repository<Event>;

  const mockUserRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  };

  const mockCampaignRepo = {
    count: jest.fn(),
  };

  const mockScholarRepo = {
    count: jest.fn(),
  };

  const mockEventRepo = {
    count: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(DonationCampaign),
          useValue: mockCampaignRepo,
        },
        {
          provide: getRepositoryToken(Scholarship),
          useValue: mockScholarRepo,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepo,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    campaignRepo = module.get<Repository<DonationCampaign>>(getRepositoryToken(DonationCampaign));
    scholarRepo = module.get<Repository<Scholarship>>(getRepositoryToken(Scholarship));
    eventRepo = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return admin statistics', async () => {
      jest.spyOn(userRepo, 'count').mockResolvedValue(100);
      jest.spyOn(campaignRepo, 'count').mockResolvedValue(10);
      jest.spyOn(scholarRepo, 'count').mockResolvedValue(25);
      jest.spyOn(eventRepo, 'count').mockResolvedValue(5);

      const result = await service.getStats();

      expect(result).toEqual({
        total_users: 100,
        active_campaigns: 10,
        pending_verifications: 0,
        total_scholarships: 25,
        upcoming_events: 5,
      });
    });
  });

  describe('findAllUsers', () => {
    it('should return paginated users', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAllUsers({ page: 1, limit: 10 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('findOneUser', () => {
    it('should return a user by id', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.findOneUser('1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await expect(service.findOneUser('nonexistent')).rejects.toThrow('User with ID nonexistent not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const mockUser = { id: '1', status: 'active' };
      const mockAdminUser = { id: 'admin-1' } as any;
      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepo, 'save').mockResolvedValue({ ...mockUser, status: 'inactive' } as any);

      const result = await service.updateUserStatus('1', { status: 'inactive' }, mockAdminUser as any);

      expect(result.status).toBe('inactive');
    });
  });
});