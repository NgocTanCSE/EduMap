import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScholarshipService } from './scholarship.service';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { User } from '../auth/entities/user.entity';
import { Repository } from 'typeorm';

describe('ScholarshipService', () => {
  let service: ScholarshipService;
  let scholarRepo: Repository<Scholarship>;
  let appRepo: Repository<ScholarshipApplication>;
  let userRepo: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScholarshipService,
        {
          provide: getRepositoryToken(Scholarship),
          useValue: {
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScholarshipApplication),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
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

    service = module.get<ScholarshipService>(ScholarshipService);
    scholarRepo = module.get<Repository<Scholarship>>(getRepositoryToken(Scholarship));
    appRepo = module.get<Repository<ScholarshipApplication>>(getRepositoryToken(ScholarshipApplication));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllScholarships', () => {
    it('should return paginated scholarships', async () => {
      const mockScholarships = [
        { id: 'sch-1', title: 'Scholarship A', status: 'active', deleted_at: null },
        { id: 'sch-2', title: 'Scholarship B', status: 'active', deleted_at: null },
      ];

      jest.spyOn(scholarRepo, 'findAndCount').mockResolvedValue([mockScholarships, 2] as any);

      const result = await service.getAllScholarships(1, 10);

      expect(result).toBeDefined();
      expect(result.items).toEqual(mockScholarships);
      expect(result.meta.totalItems).toBe(2);
    });
  });

  describe('checkEligibility', () => {
    it('should check eligibility via AI service', async () => {
      const mockScholar = {
        id: 'sch-1',
        title: 'Test Scholarship',
        status: 'active',
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      jest.spyOn(scholarRepo, 'findOne').mockResolvedValue(mockScholar as Scholarship);
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as User);

      const mockAiResult = {
        eligible: true,
        score: 85,
        feedback: 'You meet all criteria',
      };

      jest.spyOn(service as any, 'aiService').mockReturnValue({
        checkScholarshipEligibility: jest.fn().mockResolvedValue(mockAiResult),
      });

      const result = await service.checkEligibility('user-1', 'sch-1');

      expect(result).toBeDefined();
    });
  });

  describe('applyScholarship', () => {
    it('should create a new scholarship application', async () => {
      const mockScholar = {
        id: 'sch-1',
        title: 'Test Scholarship',
        status: 'active',
      };

      const mockApplication = {
        id: 'app-1',
        scholarship_id: 'sch-1',
        student_id: 'user-1',
        personal_statement: 'My statement',
        cv_url: 'http://cv.pdf',
        status: 'pending',
      };

      jest.spyOn(scholarRepo, 'findOne').mockResolvedValue(mockScholar as Scholarship);
      jest.spyOn(appRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(appRepo, 'create').mockReturnValue(mockApplication as ScholarshipApplication);
      jest.spyOn(appRepo, 'save').mockResolvedValue(mockApplication as ScholarshipApplication);

      const result = await service.applyScholarship('user-1', 'sch-1', 'My statement', 'http://cv.pdf');

      expect(result).toBeDefined();
      expect(result.id).toBe('app-1');
      expect(result.status).toBe('pending');
    });

    it('should throw BadRequestException when already applied', async () => {
      const mockScholar = { id: 'sch-1', status: 'active' };
      const mockExisting = { id: 'app-1', student_id: 'user-1', scholarship_id: 'sch-1' };

      jest.spyOn(scholarRepo, 'findOne').mockResolvedValue(mockScholar as Scholarship);
      jest.spyOn(appRepo, 'findOne').mockResolvedValue(mockExisting as ScholarshipApplication);

      await expect(
        service.applyScholarship('user-1', 'sch-1', 'statement', 'http://cv.pdf'),
      ).rejects.toThrow();
    });
  });

  describe('getUserApplications', () => {
    it('should return list of applications for a user', async () => {
      const mockApplications = [
        { id: 'app-1', student_id: 'user-1', scholarship: { id: 'sch-1', title: 'A' } },
        { id: 'app-2', student_id: 'user-1', scholarship: { id: 'sch-2', title: 'B' } },
      ];

      jest.spyOn(appRepo, 'find').mockResolvedValue(mockApplications as ScholarshipApplication[]);

      const result = await service.getUserApplications('user-1');

      expect(result).toEqual(mockApplications);
      expect(appRepo.find).toHaveBeenCalledWith({
        where: { student_id: 'user-1' },
        relations: ['scholarship'],
        order: { created_at: 'DESC' },
      });
    });
  });
});
