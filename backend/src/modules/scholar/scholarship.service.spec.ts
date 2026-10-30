import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScholarshipService } from './scholarship.service';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AIService } from '../ai/ai.service';
import { DEV_USER_UUID } from '../../common/constants/dev-user.constants';

describe('ScholarshipService', () => {
  let service: ScholarshipService;
  let scholarRepo: jest.Mocked<Repository<Scholarship>>;
  let appRepo: jest.Mocked<Repository<ScholarshipApplication>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    scholarRepo = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Scholarship>>;

    appRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ScholarshipApplication>>;

    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const mockAIService = {
      checkScholarshipEligibility: jest.fn(),
      triggerKnowledgeSync: jest.fn(),
    };

    const mockNotifyService = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScholarshipService,
        { provide: getRepositoryToken(Scholarship), useValue: scholarRepo },
        { provide: getRepositoryToken(ScholarshipApplication), useValue: appRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AIService, useValue: mockAIService },
        { provide: NotificationsService, useValue: mockNotifyService },
      ],
    }).compile();

    service = module.get<ScholarshipService>(ScholarshipService);
    aiService = module.get(AIService);
  });

  describe('checkEligibility', () => {
    const mockScholarship = { id: 'scholar-1', title: 'Test Scholarship' };

    it('should throw NotFoundException when scholarship does not exist', async () => {
      scholarRepo.findOne.mockResolvedValue(null);
      await expect(
        service.checkEligibility(DEV_USER_UUID, 'nonexistent-scholarship'),
      ).rejects.toThrow('Học bổng không tồn tại');
    });

    it('should throw NotFoundException when neither user nor dev user exists', async () => {
      scholarRepo.findOne.mockResolvedValue(mockScholarship as any);
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.checkEligibility('lost-user-id', 'scholar-1'),
      ).rejects.toThrow('Người dùng không tồn tại');
    });

    it('should fall back to dev user when requested user is not found (HF Spaces restart scenario)', async () => {
      scholarRepo.findOne.mockResolvedValue(mockScholarship as any);

      const devUser = {
        id: DEV_USER_UUID,
        email: 'dev@edumap.com',
        full_name: 'Dev User',
        role: 'student',
        skills: [],
        mbti_type: '',
      };

      // First call (by userId) → null (user lost on container restart)
      // Second call (by DEV_USER_UUID) → dev user found
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(devUser as any);

      const aiResult = { is_eligible: true, message: 'OK' };
      aiService.checkScholarshipEligibility.mockResolvedValue(aiResult as any);

      const result = await service.checkEligibility('lost-user-id', 'scholar-1');

      expect(result).toEqual(aiResult);
      expect(aiService.checkScholarshipEligibility).toHaveBeenCalledWith(
        devUser, mockScholarship, null
      );
    });

    it('should use the requested user when found', async () => {
      scholarRepo.findOne.mockResolvedValue(mockScholarship as any);

      const realUser = {
        id: 'real-user-id',
        email: 'user@example.com',
        full_name: 'Real User',
        role: 'student',
        skills: [],
        mbti_type: '',
      };

      userRepo.findOne.mockResolvedValue(realUser as any);

      const aiResult = { is_eligible: false, message: 'Not eligible' };
      aiService.checkScholarshipEligibility.mockResolvedValue(aiResult as any);

      const result = await service.checkEligibility('real-user-id', 'scholar-1');

      expect(result).toEqual(aiResult);
      expect(aiService.checkScholarshipEligibility).toHaveBeenCalledWith(
        realUser, mockScholarship, null
      );
      // Dev user lookup should NOT happen when the real user is found
      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
