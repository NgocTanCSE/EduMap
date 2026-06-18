import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SurveyService } from './survey.service';
import { Survey } from './entities/survey.entity';
import { Repository } from 'typeorm';

describe('SurveyService', () => {
  let service: SurveyService;
  let repo: Repository<Survey>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyService,
        {
          provide: getRepositoryToken(Survey),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SurveyService>(SurveyService);
    repo = module.get<Repository<Survey>>(getRepositoryToken(Survey));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSurveys', () => {
    it('should return array of surveys', async () => {
      const mockSurveys = [
        { id: 'survey-1', title: 'Student Satisfaction', status: 'active' },
        { id: 'survey-2', title: 'Course Evaluation', status: 'active' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockSurveys as Survey[]);

      const result = await service.getSurveys();

      expect(result).toEqual(mockSurveys);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getSurveyById', () => {
    it('should return survey when found', async () => {
      const mockSurvey = { id: 'survey-1', title: 'Student Satisfaction', status: 'active' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockSurvey as Survey);

      const result = await service.getSurveyById('survey-1');

      expect(result).toEqual(mockSurvey);
    });

    it('should throw error when survey not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getSurveyById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createSurvey', () => {
    it('should create new survey', async () => {
      const mockSurvey = { id: 'survey-1', title: 'New Survey', status: 'draft' };
      jest.spyOn(repo, 'create').mockReturnValue(mockSurvey as Survey);
      jest.spyOn(repo, 'save').mockResolvedValue(mockSurvey as Survey);

      const result = await service.createSurvey({
        title: 'New Survey',
        description: 'Survey description',
        questions_json: { q1: { type: 'text', question: 'What?' } },
        created_by: 'user-1',
      });

      expect(result).toEqual(mockSurvey);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
