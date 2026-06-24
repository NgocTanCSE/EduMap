import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEvent } from '../analytics/entities/user-event.entity';
import { EducationStat } from '../analytics/entities/education-stat.entity';
import { User } from '../auth/entities/user.entity';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Repository } from 'typeorm';

describe('DashboardService', () => {
  let service: DashboardService;
  let userEventRepo: Repository<UserEvent>;
  let educationStatRepo: Repository<EducationStat>;

  const mockUserEventRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEducationStatRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(UserEvent),
          useValue: mockUserEventRepo,
        },
        {
          provide: getRepositoryToken(EducationStat),
          useValue: mockEducationStatRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(LearningMaterial),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    userEventRepo = module.get<Repository<UserEvent>>(getRepositoryToken(UserEvent));
    educationStatRepo = module.get<Repository<EducationStat>>(getRepositoryToken(EducationStat));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverviewStats', () => {
    it('should return overview statistics', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ total_events: '100' }]),
      };
      jest.spyOn(userEventRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getOverviewStats('test-user-id');

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('getDailyInsight', () => {
    it('should return daily insight data', async () => {
      const result = await service.getDailyInsight('test-user-id');
      expect(result).toHaveProperty('success', true);
    });
  });
});