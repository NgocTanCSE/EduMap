import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CareerService } from './career.service';
import { CareerPath } from './entities/career.entity';
import { Job } from './entities/job.entity';
import { UserCareer } from './entities/user-career.entity';
import { UserSkill } from './entities/user-skill.entity';
import { Application } from './entities/application.entity';
import { Repository } from 'typeorm';

describe('CareerService', () => {
  let service: CareerService;
  let careerPathRepo: Repository<CareerPath>;
  let jobRepo: Repository<Job>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerService,
        {
          provide: getRepositoryToken(CareerPath),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserCareer),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserSkill),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CareerService>(CareerService);
    careerPathRepo = module.get<Repository<CareerPath>>(getRepositoryToken(CareerPath));
    jobRepo = module.get<Repository<Job>>(getRepositoryToken(Job));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCareerPaths', () => {
    it('should return array of career paths', async () => {
      const mockPaths = [
        { id: 1, title: 'AI Engineer', description: 'AI Engineer career' },
        { id: 2, title: 'Data Scientist', description: 'Data Scientist career' },
      ];
      jest.spyOn(careerPathRepo, 'find').mockResolvedValue(mockPaths as CareerPath[]);

      const result = await service.getCareerPaths();

      expect(result).toEqual(mockPaths);
      expect(careerPathRepo.find).toHaveBeenCalled();
    });
  });

  describe('getJobs', () => {
    it('should return array of jobs', async () => {
      const mockJobs = [
        { id: 'job-1', title: 'Frontend Developer', status: 'active' },
        { id: 'job-2', title: 'Backend Developer', status: 'active' },
      ];
      jest.spyOn(jobRepo, 'find').mockResolvedValue(mockJobs as Job[]);

      const result = await service.getJobs();

      expect(result).toEqual(mockJobs);
      expect(jobRepo.find).toHaveBeenCalled();
    });
  });

  describe('getJobById', () => {
    it('should return job when found', async () => {
      const mockJob = { id: 'job-1', title: 'Frontend Developer', status: 'active' };
      jest.spyOn(jobRepo, 'findOne').mockResolvedValue(mockJob as Job);

      const result = await service.getJobById('job-1');

      expect(result).toEqual(mockJob);
    });

    it('should throw error when job not found', async () => {
      jest.spyOn(jobRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getJobById('nonexistent')).rejects.toThrow();
    });
  });
});
