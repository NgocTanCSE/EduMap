import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteerService } from './volunteer.service';
import { VolunteerActivity } from './entities/volunteer.entity';
import { Repository } from 'typeorm';

describe('VolunteerService', () => {
  let service: VolunteerService;
  let repo: Repository<VolunteerActivity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteerService,
        {
          provide: getRepositoryToken(VolunteerActivity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VolunteerService>(VolunteerService);
    repo = module.get<Repository<VolunteerActivity>>(getRepositoryToken(VolunteerActivity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActivities', () => {
    it('should return array of volunteer activities', async () => {
      const mockActivities = [
        { id: 'activity-1', title: 'Beach Cleanup', hours: 4 },
        { id: 'activity-2', title: 'Teaching Kids', hours: 8 },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockActivities as VolunteerActivity[]);

      const result = await service.getActivities();

      expect(result).toEqual(mockActivities);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('logActivity', () => {
    it('should create new volunteer activity', async () => {
      const mockActivity = { id: 'activity-1', title: 'New Activity', hours: 4 };
      jest.spyOn(repo, 'create').mockReturnValue(mockActivity as VolunteerActivity);
      jest.spyOn(repo, 'save').mockResolvedValue(mockActivity as VolunteerActivity);

      const result = await service.logActivity({
        title: 'New Activity',
        description: 'Activity description',
        hours: 4,
        date: '2026-07-15',
        volunteer_id: 'user-1',
      });

      expect(result).toEqual(mockActivity);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
