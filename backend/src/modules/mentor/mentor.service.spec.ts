import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MentorService } from './mentor.service';
import { AIService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Mentor, Booking } from './entities/mentor.entity';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { User } from '../auth/entities/user.entity';

/**
 * Builds a TypeORM query-builder mock where every method returns the same
 * chainable object (matching real QueryBuilder behaviour — each call returns
 * `this`).  Callers can inspect any step (andWhere, limit, etc.).
 */
function mockQueryBuilder(mentors: any[]) {
  const calls: Record<string, any[]> = {};

  const qb: any = {
    leftJoinAndSelect: jest.fn((...args: any[]) => { calls.leftJoinAndSelect = args; return qb; }),
    where: jest.fn((...args: any[]) => { calls.where = args; return qb; }),
    andWhere: jest.fn((...args: any[]) => { calls.andWhere = args; return qb; }),
    orderBy: jest.fn((...args: any[]) => { calls.orderBy = args; return qb; }),
    limit: jest.fn((...args: any[]) => { calls.limit = args; return qb; }),
    getMany: jest.fn().mockResolvedValue(mentors),
  };

  return { qb, calls };
}

describe('MentorService', () => {
  let service: MentorService;
  let mentorRepo: jest.Mocked<Repository<Mentor>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    mentorRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mentor>>;

    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const mockAIService = {
      matchMentor: jest.fn(),
    };

    const mockNotifyService = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorService,
        { provide: getRepositoryToken(Mentor), useValue: mentorRepo },
        { provide: getRepositoryToken(Booking), useValue: {} },
        { provide: getRepositoryToken(MentorAvailability), useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AIService, useValue: mockAIService },
        { provide: NotificationsService, useValue: mockNotifyService },
      ],
    }).compile();

    service = module.get<MentorService>(MentorService);
    aiService = module.get(AIService);
  });

  describe('getAIRecommendedMentors — pre-filter', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getAIRecommendedMentors('nonexistent-user')).rejects.toThrow(
        'Người dùng không tồn tại',
      );
    });

    it('should return "no mentors" message when DB returns 0 mentors after pre-filter', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        email: 'student@example.com',
        full_name: 'Student A',
        skills: ['Python'],
        interests: ['AI'],
        major: 'Computer Science',
        mbti_type: 'INTJ',
      } as any);

      const { qb } = mockQueryBuilder([]);
      mentorRepo.createQueryBuilder = jest.fn(() => qb) as any;

      const result = await service.getAIRecommendedMentors('stu-1');
      expect(result).toEqual({ message: 'Hiện chưa có mentor nào phù hợp.' });
      expect(aiService.matchMentor).not.toHaveBeenCalled();
    });

    it('should pre-filter mentors by specialty and send only limited set (not ALL mentors)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        email: 'student@example.com',
        full_name: 'Student A',
        skills: ['Python', 'AI', 'Machine Learning'],
        interests: ['Data Science'],
        major: 'Computer Science',
        mbti_type: 'INTJ',
      } as any);

      const mockMentors = Array.from({ length: 15 }, (_, i) => ({
        user_id: `mentor-${i}`,
        user: { full_name: `Mentor ${i}` },
        bio: 'Test bio',
        specialties: ['AI', 'Python'],
        experience_years: 3,
        rating_avg: 4.5,
      }));

      const { qb, calls } = mockQueryBuilder(mockMentors);
      mentorRepo.createQueryBuilder = jest.fn(() => qb) as any;

      aiService.matchMentor.mockResolvedValue({ top_matches: [] });

      await service.getAIRecommendedMentors('stu-1', { specialty: 'AI' });

      // Verify the query was limited to 15 (not all mentors)
      expect(calls.limit).toEqual([15]);
      expect(calls.andWhere).toBeDefined();

      // Verify AI input contains pre-filter metadata
      const aiInput = aiService.matchMentor.mock.calls[0][0];
      expect(aiInput.available_mentors).toHaveLength(15);
      expect(aiInput.available_mentors[0]).toMatchObject({
        mentor_id: 'mentor-0',
        name: 'Mentor 0',
        specialties: ['AI', 'Python'],
        skills: ['AI', 'Python'], // alias
      });
      expect(aiInput).toHaveProperty('student_specialty', 'AI');
      expect(aiInput).toHaveProperty('max_mentors', 15);
    });

    it('should cap mentors at MAX_MENTORS_TO_LLM (15) to prevent token overflow', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        skills: ['Python'],
        major: 'Computer Science',
        mbti_type: 'INTJ',
      } as any);

      const mockMentors = Array.from({ length: 15 }, (_, i) => ({
        user_id: `mentor-${i}`,
        user: { full_name: `Mentor ${i}` },
        specialties: ['Python'],
        rating_avg: 4.5,
      }));

      const { qb, calls } = mockQueryBuilder(mockMentors);
      mentorRepo.createQueryBuilder = jest.fn(() => qb) as any;

      aiService.matchMentor.mockResolvedValue({ top_matches: [] });

      await service.getAIRecommendedMentors('stu-1');

      const aiInput = aiService.matchMentor.mock.calls[0][0];
      expect(aiInput.available_mentors).toHaveLength(15);
      expect(calls.limit).toEqual([15]);

      // Verify each mentor has fields matching Pydantic MentorProfile model
      aiInput.available_mentors.forEach((m: any) => {
        expect(m).toHaveProperty('mentor_id');
        expect(m).toHaveProperty('specialties');
        expect(m).toHaveProperty('skills');
        expect(m).toHaveProperty('mbti');
        expect(m).toHaveProperty('available_days');
      });
    });

    it('should use LIKE query (SQLite-compatible) not @> (PostgreSQL-only)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        skills: ['Python'],
        major: 'Computer Science',
        mbti_type: 'INTJ',
      } as any);

      const { qb, calls } = mockQueryBuilder([]);
      mentorRepo.createQueryBuilder = jest.fn(() => qb) as any;

      await service.getAIRecommendedMentors('stu-1');

      // Verify the filter uses LOWER + LIKE (SQLite compatible), not @>
      expect(calls.andWhere).toBeDefined();
      const condition = calls.andWhere![0];
      expect(condition).toContain('LOWER(mentor.specialties)');
      expect(condition).toContain('LIKE');
      expect(condition).not.toContain('@>');
    });

    it('should skip specialty filter when student has no skills/major/interests', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        skills: [],
        major: null,
        mbti_type: 'ENFP',
        interests: [],
      } as any);

      const { qb, calls } = mockQueryBuilder([]);
      mentorRepo.createQueryBuilder = jest.fn(() => qb) as any;

      await service.getAIRecommendedMentors('stu-1');

      // No specialty filters → andWhere should NOT be called (only .where)
      expect(calls.andWhere).toBeUndefined();
    });
  });
});
