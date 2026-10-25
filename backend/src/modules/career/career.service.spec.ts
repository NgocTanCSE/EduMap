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

    const jobRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Job>>;

    const userCareerRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserCareer>>;

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
    it('should return suggestions with frontend-compatible field names (title, match_score)', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
        { skill_name: 'React' } as any,
      ]);
      careerPathRepo.find.mockResolvedValue([
        {
          id: 1,
          title: 'Fullstack Developer',
          field: 'IT',
          description: 'Build web apps',
          skills_required: ['Python', 'TypeScript', 'React'],
          demand_level: 'Cao',
        } as any,
        {
          id: 2,
          title: 'Data Scientist',
          field: 'IT',
          description: 'Analyze data',
          skills_required: ['Python', 'SQL', 'Statistics'],
          demand_level: 'Cao',
        } as any,
      ]);

      const result = await service.suggestCareer('user-1');

      expect(result.top_suggestions).toBeDefined();
      expect(result.top_suggestions.length).toBe(2);

      const first = result.top_suggestions[0];
      // Field name must be `title` (NOT career_title)
      expect(first.title).toBe('Fullstack Developer');
      expect(first.career_title).toBeUndefined();
      // match_score must be a number (NOT a string like '100%')
      expect(typeof first.match_score).toBe('number');
      expect(first.match_score).toBeGreaterThan(0);
      // Must include frontend-expected fields
      expect(first.explanation).toBeDefined();
      expect(Array.isArray(first.missing_skills)).toBe(true);
      expect(first.demand_level).toBeDefined();
    });

    it('should return fallback suggestions when database has no career paths', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
      ]);
      careerPathRepo.find.mockResolvedValue([]);

      const result = await service.suggestCareer('user-1');

      expect(result.top_suggestions).toBeDefined();
      expect(result.top_suggestions.length).toBe(3);

      const first = result.top_suggestions[0];
      expect(first.title).toBeDefined();
      expect(typeof first.match_score).toBe('number');
      expect(Array.isArray(first.missing_skills)).toBe(true);
      expect(first.explanation).toBeDefined();
    });

    it('should return fallback suggestions when user has no skills', async () => {
      userSkillRepo.find.mockResolvedValue([]);
      careerPathRepo.find.mockResolvedValue([
        {
          id: 1,
          title: 'Fullstack Developer',
          field: 'IT',
          description: 'Build web apps',
          skills_required: ['Python', 'TypeScript'],
          demand_level: 'Cao',
        } as any,
      ]);

      const result = await service.suggestCareer('user-1');

      expect(result.top_suggestions).toBeDefined();
      expect(result.top_suggestions.length).toBeGreaterThan(0);

      const first = result.top_suggestions[0];
      expect(first.title).toBe('Fullstack Developer');
      expect(typeof first.match_score).toBe('number');
      expect(first.match_score).toBe(0); // no matching skills → 0 match
    });

    it('should compute match_score as a number based on skill overlap', async () => {
      userSkillRepo.find.mockResolvedValue([
        { skill_name: 'Python' } as any,
        { skill_name: 'React' } as any,
        { skill_name: 'Docker' } as any,
      ]);
      // 2 out of 4 skills match → 50%
      careerPathRepo.find.mockResolvedValue([
        {
          id: 1,
          title: 'Fullstack Developer',
          field: 'IT',
          skills_required: ['Python', 'React', 'Docker', 'Kubernetes'],
          demand_level: 'Cao',
        } as any,
      ]);

      const result = await service.suggestCareer('user-1');
      const suggestion = result.top_suggestions[0];
      expect(suggestion.match_score).toBe(50); // 2/4 = 50%
      expect(suggestion.missing_skills).toContain('Kubernetes');
    });
  });
});
