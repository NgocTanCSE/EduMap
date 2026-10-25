import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareerService } from './career.service';
import { AIService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { UserSkill } from './entities/user-skill.entity';
import { UserCareer } from './entities/user-career.entity';
import { Application } from './entities/application.entity';
import { User } from '../auth/entities/user.entity';
import { CareerPath } from './entities/career.entity';
import { Job } from './entities/job.entity';

describe('CareerService', () => {
  let service: CareerService;
  let careerPathRepo: jest.Mocked<Repository<CareerPath>>;
  let userSkillRepo: jest.Mocked<Repository<UserSkill>>;
  let userCareerRepo: jest.Mocked<Repository<UserCareer>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    careerPathRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<CareerPath>>;

    userSkillRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserSkill>>;

    userCareerRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserCareer>>;

    const jobRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Job>>;

    const applicationRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Application>>;

    const userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    aiService = {
      predictCareerPath: jest.fn(),
      recommendCareerSemantic: jest.fn(),
      triggerKnowledgeSync: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    const storageService = {
      uploadFile: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerService,
        { provide: getRepositoryToken(CareerPath), useValue: careerPathRepo },
        { provide: getRepositoryToken(Job), useValue: jobRepo },
        { provide: getRepositoryToken(UserCareer), useValue: userCareerRepo },
        { provide: getRepositoryToken(UserSkill), useValue: userSkillRepo },
        { provide: getRepositoryToken(Application), useValue: applicationRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AIService, useValue: aiService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<CareerService>(CareerService);
  });

  describe('suggestCareer', () => {
    it('should return semantic-vector suggestions from AI service with frontend-compatible field names', async () => {
      // Mock user skills + interests (career aspirations)
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
        { skill_name: 'React' } as any,
      ]);
      userCareerRepo.find.mockResolvedValue([
        { goal_title: 'AI Engineer' } as any,
      ]);
      careerPathRepo.find.mockResolvedValue([
        { id: 1, title: 'AI Engineer', field: 'IT', description: 'Build AI systems', skills_required: ['Python', 'ML'], demand_level: 'Cao' } as any,
      ]);

      // Mock the AI semantic-vector service (ChromaDB cosine similarity)
      (aiService.recommendCareerSemantic as jest.Mock).mockResolvedValue({
        top_careers: [
          {
            title: 'AI Engineer',
            field: 'IT',
            match_score: 92,
            explanation: 'Strong semantic match with your Python and ML skills.',
            missing_skills: ['Deep Learning'],
            demand_level: 'Cao',
            radar_chart: { Technical: 92, 'Soft Skills': 75, 'Problem Solving': 88, Language: 80, Creativity: 70 },
          },
        ],
        degraded: false,
        source: 'semantic-chroma',
      });

      const result = await service.suggestCareer('user-1');

      // Must call the semantic endpoint
      expect(aiService.recommendCareerSemantic).toHaveBeenCalled();

      // Field names must match frontend expectations
      expect(result.top_suggestions).toBeDefined();
      expect(result.top_suggestions.length).toBe(1);

      const first = result.top_suggestions[0];
      expect(first.title).toBe('AI Engineer');
      expect(first.career_title).toBeUndefined(); // old name must NOT be used
      expect(typeof first.match_score).toBe('number');
      expect(first.match_score).toBe(92);
      expect(first.explanation).toBeDefined();
      expect(Array.isArray(first.missing_skills)).toBe(true);
      expect(first.demand_level).toBe('Cao');
      expect(first.radar_chart).toBeDefined();
      expect(result.source).toBe('semantic-chroma');
      expect(result.degraded).toBe(false);
    });

    it('should fall back to curated template (NOT if-else keyword matching) when AI service is unavailable', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
      ]);
      userCareerRepo.find.mockResolvedValue([]);
      careerPathRepo.find.mockResolvedValue([]);

      // AI service returns null (unavailable)
      (aiService.recommendCareerSemantic as jest.Mock).mockResolvedValue(null);

      const result = await service.suggestCareer('user-1');

      // Must have called the semantic endpoint
      expect(aiService.recommendCareerSemantic).toHaveBeenCalled();

      // Should return template fallback (not if-else keyword matching)
      expect(result.top_suggestions).toBeDefined();
      expect(result.top_suggestions.length).toBe(3);
      expect(result.degraded).toBe(true);
      expect(result.source).toBe('template-fallback');

      const first = result.top_suggestions[0];
      expect(first.title).toBe('AI Engineer / Machine Learning Engineer');
      expect(first.career_title).toBeUndefined();
      expect(typeof first.match_score).toBe('number');
      expect(first.match_score).toBe(85);
      expect(Array.isArray(first.missing_skills)).toBe(true);
      expect(first.demand_level).toBe('Cao');
    });

    it('should use template fallback when AI semantic returns empty top_careers', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
      ]);
      userCareerRepo.find.mockResolvedValue([]);
      careerPathRepo.find.mockResolvedValue([]);

      // AI service returns empty top_careers
      (aiService.recommendCareerSemantic as jest.Mock).mockResolvedValue({
        top_careers: [],
        degraded: true,
        source: 'fallback-template',
      });

      const result = await service.suggestCareer('user-1');

      // Should fall through to template fallback
      expect(result.top_suggestions.length).toBe(3);
      expect(result.degraded).toBe(true);
      expect(result.source).toBe('template-fallback');
    });

    it('should include input_analysis with skills and interests', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
        { skill_name: 'Docker' } as any,
      ]);
      userCareerRepo.find.mockResolvedValue([
        { goal_title: 'DevOps' } as any,
      ]);
      careerPathRepo.find.mockResolvedValue([]);

      (aiService.recommendCareerSemantic as jest.Mock).mockResolvedValue(null);

      const result = await service.suggestCareer('user-1');

      expect(result.input_analysis.skills).toEqual(['python', 'docker']);
      expect(result.input_analysis.interests).toEqual(['DevOps']);
    });
  });
});
