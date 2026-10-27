import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpportunityMatchingService } from './opportunity-matching.service';
import { Opportunity } from './entities/opportunity.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Job } from '../career/entities/job.entity';
import { User } from '../auth/entities/user.entity';
import { AIService } from '../ai/ai.service';

/**
 * Build a mock TypeORM QueryBuilder whose chainable methods return itself
 * and whose getRawMany() resolves to `rows`.
 */
function mockQueryBuilder(rows: any[]) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
}

describe('OpportunityMatchingService', () => {
  let service: OpportunityMatchingService;
  let oppRepo: jest.Mocked<Repository<Opportunity>>;
  let scholarRepo: jest.Mocked<Repository<Scholarship>>;
  let jobRepo: jest.Mocked<Repository<Job>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let aiService: { matchOpportunities: jest.Mock };

  beforeEach(async () => {
    const mockOppRepo = {
      createQueryBuilder: jest.fn(),
      manager: { query: jest.fn() },
      findOne: jest.fn(),
    };
    const mockScholarRepo = {
      createQueryBuilder: jest.fn(),
      manager: { query: jest.fn() },
      findOne: jest.fn(),
    };
    const mockJobRepo = {
      createQueryBuilder: jest.fn(),
      manager: { query: jest.fn() },
      findOne: jest.fn(),
    };
    const mockUserRepo = {
      findOne: jest.fn(),
    };
    aiService = { matchOpportunities: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityMatchingService,
        { provide: getRepositoryToken(Opportunity), useValue: mockOppRepo },
        { provide: getRepositoryToken(Scholarship), useValue: mockScholarRepo },
        { provide: getRepositoryToken(Job), useValue: mockJobRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<OpportunityMatchingService>(OpportunityMatchingService);
    oppRepo = module.get(getRepositoryToken(Opportunity));
    scholarRepo = module.get(getRepositoryToken(Scholarship));
    jobRepo = module.get(getRepositoryToken(Job));
    userRepo = module.get(getRepositoryToken(User));
  });

  const SAMPLE_USER = {
    id: 'user-1',
    full_name: 'Nguyễn Văn A',
    major: 'Công nghệ thông tin',
    skills: ['Python', 'React'],
    interests: ['AI'],
    location: 'Hồ Chí Minh',
    role: 'student',
  };

  const SAMPLE_OPP_ROWS = [
    { id: 'o1', title: 'DevFest 2024', type: 'competition', organization: 'GDG',
      description: 'Cuộc thi lập trình', requirements: 'Python', benefits: '',
      url: 'https://devfest.vn', field_tags: ['Python'], region: 'Hà Nội',
      deadline: '2099-12-31', status: 'active' },
  ];

  const SAMPLE_SCHOLAR_ROWS = [
    { id: 's1', title: 'Học bổng AU', type: 'scholarship',
      description: 'Học bổng toàn phần', deadline: '2099-12-31',
      eligibility_criteria: ['GPA 3.0+'], apply_url: 'https://au.edu.vn',
      value_amount: 10000, provider: 'AUSTRADE', status: 'active' },
  ];

  describe('getUserProfile', () => {
    it('should fetch and normalise the user profile from the User entity', async () => {
      userRepo.findOne.mockResolvedValue(SAMPLE_USER as any);
      const profile = await service.getUserProfile('user-1');
      expect(profile.id).toBe('user-1');
      expect(profile.major).toBe('Công nghệ thông tin');
      expect(profile.skills).toEqual(['Python', 'React']);
      expect(profile.gpa).toBeNull();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserProfile('nope')).rejects.toThrow(
        'Người dùng không tồn tại',
      );
    });
  });

  describe('preFilterOpportunities', () => {
    beforeEach(() => {
      oppRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder(SAMPLE_OPP_ROWS));
      scholarRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder(SAMPLE_SCHOLAR_ROWS));
      jobRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder([]));
    });

    it('should return normalised candidates from all three tables', async () => {
      const result = await service.preFilterOpportunities();
      expect(result.length).toBe(2);
      // Opportunity row normalised with source_table
      const opp = result.find((c) => c.source_table === 'opportunities');
      expect(opp).toBeDefined();
      expect(opp?.type).toBe('competition');
      expect(opp?.field_tags).toEqual(['Python']);
      // Scholarship row normalised with type='scholarship'
      const scholar = result.find((c) => c.source_table === 'scholarships');
      expect(scholar).toBeDefined();
      expect(scholar?.type).toBe('scholarship');
      expect(scholar?.url).toBe('https://au.edu.vn');
      expect(scholar?.requirements).toContain('GPA 3.0+');
    });

    it('should filter by type', async () => {
      const result = await service.preFilterOpportunities({ type: 'scholarship' });
      expect(result.length).toBe(1);
      expect(result[0].source_table).toBe('scholarships');
    });

    it('should use LIKE keyword filter when field is provided', async () => {
      const result = await service.preFilterOpportunities({ field: 'React' });
      const qb = oppRepo.createQueryBuilder();
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('matchOpportunities', () => {
    beforeEach(() => {
      userRepo.findOne.mockResolvedValue(SAMPLE_USER as any);
      oppRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder(SAMPLE_OPP_ROWS));
      scholarRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder(SAMPLE_SCHOLAR_ROWS));
      jobRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder([]));
    });

    it('should delegate to AIService and return its result', async () => {
      const aiResult = { user_id: 'user-1', matches: [{ id: 's1', match_score: 85 }], total: 1, filtered_count: 0, degraded: false, reason: null };
      aiService.matchOpportunities.mockResolvedValue(aiResult);

      const result = await service.matchOpportunities('user-1');
      expect(aiService.matchOpportunities).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.degraded).toBe(false);
    });

    it('should fall back to keyword scoring when AIService throws', async () => {
      aiService.matchOpportunities.mockRejectedValue(new Error('AI down'));

      const result = await service.matchOpportunities('user-1');
      expect(result.degraded).toBe(true);
      expect(result.reason).toContain('AI unavailable');
      expect(result.matches.length).toBeGreaterThan(0);
      // Expired opportunities excluded
      expect(result.matches.every((m: any) => m.match_score >= 0)).toBe(true);
    });
  });
});
