import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamificationService } from './gamification.service';
import { Repository } from 'typeorm';
import { Badge, UserBadge, UserPoint } from './entities/gamification.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { User } from '../auth/entities/user.entity';

describe('GamificationService', () => {
  let service: GamificationService;
  let badgeRepo: Repository<Badge>;
  let userBadgeRepo: Repository<UserBadge>;
  let userPointRepo: Repository<UserPoint>;
  let greenActivityRepo: Repository<GreenActivity>;
  let userRepo: Repository<User>;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getRepositoryToken(Badge),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserBadge),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserPoint),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(GreenActivity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    badgeRepo = module.get<Repository<Badge>>(getRepositoryToken(Badge));
    userBadgeRepo = module.get<Repository<UserBadge>>(getRepositoryToken(UserBadge));
    userPointRepo = module.get<Repository<UserPoint>>(getRepositoryToken(UserPoint));
    greenActivityRepo = module.get<Repository<GreenActivity>>(getRepositoryToken(GreenActivity));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserProgress', () => {
    it('should return user progress with points and badges', async () => {
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockReturnValue({
        ...mockQueryBuilder,
        getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
      } as any);
      jest.spyOn(userBadgeRepo, 'find').mockResolvedValue([
        { badge: { name: 'First Badge' } },
      ]);

      const result = await service.getUserProgress('user-1');

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.points).toBe(500);
      expect(result.achievements).toEqual(['First Badge']);
    });

    it('should return zero points and empty achievements on error', async () => {
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await service.getUserProgress('user-1');

      expect(result).toBeDefined();
      expect(result.points).toBe(0);
      expect(result.achievements).toEqual([]);
    });
  });

  describe('getLeaderboard', () => {
    it('should return top 10 users sorted by points', async () => {
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockReturnValue({
        ...mockQueryBuilder,
        getRawMany: jest.fn().mockResolvedValue([
          { id: 'u1', full_name: 'Alice', avatar_url: 'a.jpg', points: '950' },
          { id: 'u2', full_name: 'Bob', avatar_url: 'b.jpg', points: '300' },
        ]),
      } as any);

      const result = await service.getLeaderboard();

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].level).toBe(10);
      expect(result[1].level).toBe(4);
    });

    it('should fallback on error', async () => {
      jest.spyOn(userPointRepo, 'createQueryBuilder').mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await service.getLeaderboard();

      expect(result).toEqual([]);
    });
  });

  describe('awardPoints', () => {
    it('should create user point entry and return updated progress', async () => {
      const mockCreated = { user_id: 'user-1', points: 50, action: 'test', reference_id: 'ref-1', id: 'up-1' };
      jest.spyOn(userPointRepo, 'create').mockReturnValue(mockCreated as UserPoint);
      jest.spyOn(userPointRepo, 'save').mockResolvedValue(mockCreated as UserPoint);
      jest.spyOn(service, 'getUserProgress' as any).mockResolvedValue({
        userId: 'user-1',
        points: 550,
        achievements: [],
      } as any);

      const result = await service.awardPoints('user-1', 50, 'test', 'ref-1');

      expect(result).toBeDefined();
      expect(result.points).toBe(550);
      expect(userPointRepo.create).toHaveBeenCalledWith({
        user_id: 'user-1',
        points: 50,
        action: 'test',
        reference_id: 'ref-1',
      });
    });

    it('should skip saving when points is 0', async () => {
      jest.spyOn(userPointRepo, 'create');
      jest.spyOn(userPointRepo, 'save');
      jest.spyOn(service, 'getUserProgress' as any).mockResolvedValue({
        userId: 'user-1',
        points: 500,
        achievements: [],
      } as any);

      const result = await service.awardPoints('user-1', 0);

      expect(userPointRepo.create).not.toHaveBeenCalled();
      expect(userPointRepo.save).not.toHaveBeenCalled();
      expect(result.points).toBe(500);
    });
  });

  describe('grantAchievement', () => {
    it('should create badge and grant it to user', async () => {
      const mockBadge = { id: 1, name: 'Speedster', category: 'general', points_criteria: 0 };
      jest.spyOn(badgeRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(badgeRepo, 'create').mockReturnValue(mockBadge as Badge);
      jest.spyOn(badgeRepo, 'save').mockResolvedValue(mockBadge as Badge);
      jest.spyOn(userBadgeRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(userBadgeRepo, 'create').mockReturnValue({ user_id: 'user-1', badge_id: 1 } as UserBadge);
      jest.spyOn(userBadgeRepo, 'save').mockResolvedValue({ user_id: 'user-1', badge_id: 1 } as UserBadge);
      jest.spyOn(service, 'getUserProgress' as any).mockResolvedValue({
        userId: 'user-1',
        points: 550,
        achievements: ['Speedster'],
      } as any);

      const result = await service.grantAchievement('user-1', 'Speedster');

      expect(badgeRepo.create).toHaveBeenCalledWith({
        name: 'Speedster',
        category: 'general',
        points_criteria: 0,
      });
      expect(userBadgeRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should not duplicate achievement if already granted', async () => {
      const mockBadge = { id: 2, name: 'Explorer', category: 'general', points_criteria: 0 };
      jest.spyOn(badgeRepo, 'findOne').mockResolvedValue(mockBadge as Badge);
      jest.spyOn(badgeRepo, 'save');
      jest.spyOn(userBadgeRepo, 'findOne').mockResolvedValue({ user_id: 'user-1', badge_id: 2 } as UserBadge);
      jest.spyOn(userBadgeRepo, 'create');
      jest.spyOn(userBadgeRepo, 'save');
      jest.spyOn(service, 'getUserProgress' as any).mockResolvedValue({
        userId: 'user-1',
        points: 550,
        achievements: ['Explorer'],
      } as any);

      const result = await service.grantAchievement('user-1', 'Explorer');

      expect(userBadgeRepo.create).not.toHaveBeenCalled();
      expect(result.achievements).toContain('Explorer');
    });
  });

  describe('submitGreenActivity', () => {
    it('should create green activity and award points', async () => {
      const mockActivity = {
        id: 'ga-1',
        user_id: 'user-1',
        activity_type: 'planting',
        description: 'Planted 10 trees',
        proof_url: 'https://img.example.com/trees.jpg',
        status: 'pending',
        ai_confidence: 0,
      };
      jest.spyOn(greenActivityRepo, 'create').mockReturnValue(mockActivity as GreenActivity);
      jest.spyOn(greenActivityRepo, 'save').mockResolvedValue(mockActivity as GreenActivity);
      jest.spyOn(service, 'awardPoints' as any).mockResolvedValue({
        userId: 'user-1',
        points: 550,
        achievements: [],
      } as any);

      const result = await service.submitGreenActivity('user-1', 'planting', 'Planted 10 trees', 'https://img.example.com/trees.jpg');

      expect(greenActivityRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.points).toBe(550);
      expect(service.awardPoints).toHaveBeenCalledWith('user-1', 50, 'GREEN_planting', 'ga-1');
    });
  });
});
