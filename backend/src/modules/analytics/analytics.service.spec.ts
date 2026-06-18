import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { EducationStat } from './entities/education-stat.entity';
import { UserEvent } from './entities/user-event.entity';
import { Repository } from 'typeorm';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let educationRepo: Repository<EducationStat>;
  let eventRepo: Repository<UserEvent>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(EducationStat),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEvent),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    educationRepo = module.get<Repository<EducationStat>>(getRepositoryToken(EducationStat));
    eventRepo = module.get<Repository<UserEvent>>(getRepositoryToken(UserEvent));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEducationStats', () => {
    it('should return education statistics', async () => {
      const mockStats = [
        { id: 1, region: 'Southeast', metric_type: 'enrollment', metric_value: 85.5 },
        { id: 2, region: 'Southeast', metric_type: 'graduation', metric_value: 78.2 },
      ];
      jest.spyOn(educationRepo, 'find').mockResolvedValue(mockStats as EducationStat[]);

      const result = await service.getEducationStats({ year: 2025 });

      expect(result).toEqual(mockStats);
      expect(educationRepo.find).toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('should track user event', async () => {
      const mockEvent = { id: 'event-1', event_type: 'page_view', user_id: 'user-1' };
      jest.spyOn(eventRepo, 'create').mockReturnValue(mockEvent as UserEvent);
      jest.spyOn(eventRepo, 'save').mockResolvedValue(mockEvent as UserEvent);

      const result = await service.trackEvent({
        event_type: 'page_view',
        user_id: 'user-1',
        metadata: { page: '/dashboard' },
      });

      expect(result).toEqual(mockEvent);
      expect(eventRepo.create).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalled();
    });
  });

  describe('getGlobalStats', () => {
    it('should return global statistics', async () => {
      jest.spyOn(eventRepo, 'find').mockResolvedValue([
        { id: '1', event_type: 'page_view', user_id: 'user-1' },
        { id: '2', event_type: 'page_view', user_id: 'user-2' },
      ] as UserEvent[]);

      const result = await service.getGlobalStats();

      expect(result).toBeDefined();
    });
  });
});
