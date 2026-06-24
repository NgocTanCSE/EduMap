import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../auth/entities/user.entity';
import { DonationCampaign } from '../donate/entities/donation.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Event } from '../events/entities/event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UserStatus } from './dto/update-user-status.dto';
import { Repository } from 'typeorm';

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: Repository<User>;
  let campaignRepo: Repository<DonationCampaign>;
  let scholarRepo: Repository<Scholarship>;
  let eventRepo: Repository<Event>;
  let auditLogService: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
          },
        },
        {
          provide: getRepositoryToken(DonationCampaign),
          useValue: {
            count: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Scholarship),
          useValue: {
            count: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Event),
          useValue: {
            count: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    campaignRepo = module.get<Repository<DonationCampaign>>(getRepositoryToken(DonationCampaign));
    scholarRepo = module.get<Repository<Scholarship>>(getRepositoryToken(Scholarship));
    eventRepo = module.get<Repository<Event>>(getRepositoryToken(Event));
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return admin statistics', async () => {
      jest.spyOn(userRepo, 'count').mockResolvedValue(100);
      jest.spyOn(campaignRepo, 'count').mockResolvedValue(10);
      jest.spyOn(scholarRepo, 'count').mockResolvedValue(20);
      jest.spyOn(eventRepo, 'count').mockResolvedValue(5);

      const result = await service.getStats();

      expect(result).toBeDefined();
      expect(result.total_users).toBe(100);
      expect(result.active_campaigns).toBe(10);
      expect(result.total_scholarships).toBe(20);
      expect(result.upcoming_events).toBe(5);
    });
  });

  describe('findAllUsers', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [{ id: '1', email: 'test@test.com', full_name: 'Test' } as User];
      const qb = userRepo.createQueryBuilder as jest.Mock;
      const mockGetManyAndCount = jest.fn().mockResolvedValue([mockUsers, 1]);
      qb.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: mockGetManyAndCount,
      });

      const result = await service.findAllUsers({ page: 1, limit: 10 });

      expect(result.items).toEqual(mockUsers);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOneUser', () => {
    it('should return a user when found', async () => {
      const mockUser = { id: '1', email: 'test@test.com', full_name: 'Test' } as User;
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findOneUser('1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await expect(service.findOneUser('nonexistent')).rejects.toThrow('User with ID nonexistent not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status and log audit', async () => {
      const mockUser = { id: '1', email: 'test@test.com', role_id: 11, status: 'active' } as any as User;
      const updatedUser = { ...mockUser, status: UserStatus.INACTIVE };
      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue(mockUser);
      jest.spyOn(userRepo, 'save').mockResolvedValue(updatedUser as any);
      jest.spyOn(auditLogService, 'log').mockResolvedValue({} as any);

      const result = await service.updateUserStatus('1', { status: UserStatus.INACTIVE }, {} as User);

      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(userRepo.save).toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalled();
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user and log audit', async () => {
      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue({ id: '1' } as any as User);
      jest.spyOn(userRepo, 'softDelete').mockResolvedValue({} as any);
      jest.spyOn(auditLogService, 'log').mockResolvedValue({} as any);

      const result = await service.softDeleteUser('1', {} as User);

      expect(result.message).toBe('User soft deleted successfully');
      expect(userRepo.softDelete).toHaveBeenCalledWith('1');
    });
  });

  describe('getPendingContent', () => {
    it('should return pending events', async () => {
      const mockEvents = [{ id: '1', title: 'Pending Event', status: 'pending' } as Event];
      jest.spyOn(eventRepo, 'findAndCount').mockResolvedValue([mockEvents, 1]);

      const result = await service.getPendingContent('event');

      expect(result.type).toBe('event');
      expect(result.items).toEqual(mockEvents);
    });

    it('should throw BadRequestException for invalid type', async () => {
      await expect(service.getPendingContent('invalid')).rejects.toThrow('Failed to fetch pending content');
    });
  });
});
