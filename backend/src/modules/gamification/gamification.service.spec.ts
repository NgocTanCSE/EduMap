import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Badge, UserBadge, UserPoint } from './entities/gamification.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';

describe('GamificationService', () => {
  let service: GamificationService;
  let badgeRepo: Repository<Badge>;
  let userBadgeRepo: Repository<UserBadge>;
  let userPointRepo: Repository<UserPoint>;
  let greenActivityRepo: Repository<GreenActivity>;

  const mockBadgeRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserBadgeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockUserPointRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGreenActivityRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getRepositoryToken(Badge),
          useValue: mockBadgeRepo,
        },
        {
          provide: getRepositoryToken(UserBadge),
          useValue: mockUserBadgeRepo,
        },
        {
          provide: getRepositoryToken(UserPoint),
          useValue: mockUserPointRepo,
        },
        {
          provide: getRepositoryToken(GreenActivity),
          useValue: mockGreenActivityRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    badgeRepo = module.get<Repository<Badge>>(getRepositoryToken(Badge));
    userBadgeRepo = module.get<Repository<UserBadge>>(getRepositoryToken(UserBadge));
    userPointRepo = module.get<Repository<UserPoint>>(getRepositoryToken(UserPoint));
    greenActivityRepo = module.get<Repository<GreenActivity>>(getRepositoryToken(GreenActivity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserProgress', () => {
    it('should return user progress with points and achievements', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '100' }),
      };
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(userBadgeRepo, 'find').mockResolvedValue([]);

      const result = await service.getUserProgress('test-user-id');

      expect(result).toHaveProperty('userId', 'test-user-id');
      expect(result).toHaveProperty('points', 100);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard data', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { id: 'user-1', points: '500' },
        ]),
      };
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getLeaderboard();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('awardPoints', () => {
    it('should award points to user', async () => {
      const mockPointEntry = { user_id: 'user-1', points: 50, action: 'test' };
      jest.spyOn(userPointRepo, 'create').mockReturnValue(mockPointEntry as any);
      jest.spyOn(userPointRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(service, 'getUserProgress').mockResolvedValue({} as any);

      await service.awardPoints('user-1', 50, 'test');

      expect(userPointRepo.create).toHaveBeenCalled();
    });
  });

  describe('submitGreenActivity', () => {
    it('should submit green activity and award points', async () => {
      const mockActivity = { user_id: 'user-1', activity_type: 'RECYCLE', proof_url: 'url' };
      jest.spyOn(greenActivityRepo, 'create').mockReturnValue(mockActivity as any);
      jest.spyOn(greenActivityRepo, 'save').mockResolvedValue({ id: 'activity-1' } as any);
      jest.spyOn(service, 'awardPoints').mockResolvedValue({} as any);

      await service.submitGreenActivity('user-1', 'RECYCLE', 'Test', 'http://example.com/proof.jpg');

      expect(greenActivityRepo.create).toHaveBeenCalled();
    });
  });
});