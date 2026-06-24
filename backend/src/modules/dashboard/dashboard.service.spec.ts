import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserEvent } from '../analytics/entities/user-event.entity';
import { UserLearningHistory } from '../library/entities/user-learning-history.entity';
import { UserCareer } from '../career/entities/user-career.entity';
import { UserSkill } from '../career/entities/user-skill.entity';
import { Post, Comment } from '../community/entities/community.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { UserCertificate } from '../certificate/entities/user-certificate.entity';
import { AIService } from '../ai/ai.service';
import { MapService } from '../map/map.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let userRepo: Repository<User>;
  let userEventRepo: Repository<UserEvent>;
  let historyRepo: Repository<UserLearningHistory>;
  let careerRepo: Repository<UserCareer>;
  let skillRepo: Repository<UserSkill>;
  let postRepo: Repository<Post>;
  let commentRepo: Repository<Comment>;
  let bookingRepo: Repository<Booking>;
  let certRepo: Repository<UserCertificate>;
  let aiService: AIService;
  let mapService: MapService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(UserEvent),
          useValue: {
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(UserLearningHistory),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserCareer),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserSkill),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(Post),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserCertificate),
          useValue: { count: jest.fn() },
        },
        {
          provide: AIService,
          useValue: {
            getDailyInsight: jest.fn().mockResolvedValue({ insight: 'Keep learning!' }),
          },
        },
        {
          provide: MapService,
          useValue: {
            findAllPois: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    userEventRepo = module.get<Repository<UserEvent>>(getRepositoryToken(UserEvent));
    historyRepo = module.get<Repository<UserLearningHistory>>(getRepositoryToken(UserLearningHistory));
    careerRepo = module.get<Repository<UserCareer>>(getRepositoryToken(UserCareer));
    skillRepo = module.get<Repository<UserSkill>>(getRepositoryToken(UserSkill));
    postRepo = module.get<Repository<Post>>(getRepositoryToken(Post));
    commentRepo = module.get<Repository<Comment>>(getRepositoryToken(Comment));
    bookingRepo = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    certRepo = module.get<Repository<UserCertificate>>(getRepositoryToken(UserCertificate));
    aiService = module.get<AIService>(AIService);
    mapService = module.get<MapService>(MapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserDashboard', () => {
    it('should return user dashboard with stats and upcoming mentoring', async () => {
      const mockUser = { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null, role: 'student' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(historyRepo, 'count').mockResolvedValue(5);
      jest.spyOn(skillRepo, 'count').mockResolvedValue(3);
      jest.spyOn(careerRepo, 'find').mockResolvedValue([]);
      jest.spyOn(postRepo, 'count').mockResolvedValue(10);
      jest.spyOn(commentRepo, 'count').mockResolvedValue(4);
      jest.spyOn(bookingRepo, 'find').mockResolvedValue([]);
      jest.spyOn(certRepo, 'count').mockResolvedValue(2);

      const result = await service.getUserDashboard('user-1');

      expect(result).toBeDefined();
      expect(result.user).toEqual(mockUser);
      expect(result.stats.learning_materials).toBe(5);
      expect(result.stats.skills_mastered).toBe(3);
      expect(result.stats.community_contributions).toBe(14);
      expect(result.stats.certificates_earned).toBe(2);
      expect(result.active_goals).toEqual([]);
    });

    it('should return upcoming mentoring with mentor details', async () => {
      const mockUser = { id: 'user-1', full_name: 'Test User', email: 'test@test.com', avatar_url: null, role: 'student' };
      const mockBooking = {
        id: 'booking-1',
        mentor: { user: { full_name: 'Mentor A' } },
        slot_start: new Date(Date.now() + 86400000),
        meeting_url: 'https://meet.example.com/abc',
      };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(historyRepo, 'count').mockResolvedValue(0);
      jest.spyOn(skillRepo, 'count').mockResolvedValue(0);
      jest.spyOn(careerRepo, 'find').mockResolvedValue([]);
      jest.spyOn(postRepo, 'count').mockResolvedValue(0);
      jest.spyOn(commentRepo, 'count').mockResolvedValue(0);
      jest.spyOn(bookingRepo, 'find').mockResolvedValue([mockBooking]);
      jest.spyOn(certRepo, 'count').mockResolvedValue(0);

      const result = await service.getUserDashboard('user-1');

      expect(result.upcoming_mentoring).toHaveLength(1);
      expect(result.upcoming_mentoring[0].mentor_name).toBe('Mentor A');
      expect(result.upcoming_mentoring[0].meeting_url).toBe('https://meet.example.com/abc');
    });
  });

  describe('getDailyInsight', () => {
    it('should call AI service to get daily insight', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({ id: 'user-1', full_name: 'Test', email: 't@t.com', avatar_url: null, role: 'student' } as User);
      jest.spyOn(historyRepo, 'count').mockResolvedValue(0);
      jest.spyOn(skillRepo, 'count').mockResolvedValue(0);
      jest.spyOn(careerRepo, 'find').mockResolvedValue([]);
      jest.spyOn(postRepo, 'count').mockResolvedValue(0);
      jest.spyOn(commentRepo, 'count').mockResolvedValue(0);
      jest.spyOn(bookingRepo, 'find').mockResolvedValue([]);
      jest.spyOn(certRepo, 'count').mockResolvedValue(0);

      jest.spyOn(aiService, 'getDailyInsight').mockResolvedValue({ insight: 'Keep it up!' });

      const result = await service.getDailyInsight('user-1');

      expect(aiService.getDailyInsight).toHaveBeenCalled();
      expect(result).toEqual({ insight: 'Keep it up!' });
    });
  });

  describe('getStats', () => {
    it('should return admin stats with overview and charts', async () => {
      jest.spyOn(userRepo, 'count').mockResolvedValue(150);
      jest.spyOn(userEventRepo, 'count').mockResolvedValue(320);
      jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue({
        ...mockQueryBuilder,
        getRawMany: jest.fn().mockResolvedValue([
          { role: 'student', count: 100 },
          { role: 'mentor', count: 30 },
        ]),
      } as any);

      jest.spyOn(mapService, 'findAllPois').mockResolvedValue([
        { lat: 10.0, lng: 106.0, category: 'tech', intensity: 0.8 },
      ]);

      const result = await service.getStats();

      expect(result).toBeDefined();
      expect(result.overview.total_users).toBe(150);
      expect(result.overview.total_events).toBe(320);
      expect(result.charts.user_roles).toContainEqual({ role: 'student', count: 100 });
      expect(result.heatmap).toHaveLength(1);
      expect(result.education_metrics).toBeDefined();
    });
  });
});
