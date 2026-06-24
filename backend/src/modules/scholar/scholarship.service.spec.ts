import { Test, TestingModule } from '@nestjs/testing';
import { ScholarshipService } from './scholarship.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { Repository } from 'typeorm';

describe('ScholarshipService', () => {
  let service: ScholarshipService;
  let scholarshipRepo: Repository<Scholarship>;

  const mockScholarshipRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockApplicationRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScholarshipService,
        {
          provide: getRepositoryToken(Scholarship),
          useValue: mockScholarshipRepo,
        },
        {
          provide: getRepositoryToken(ScholarshipApplication),
          useValue: mockApplicationRepo,
        },
      ],
    }).compile();

    service = module.get<ScholarshipService>(ScholarshipService);
    scholarshipRepo = module.get<Repository<Scholarship>>(getRepositoryToken(Scholarship));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all scholarships', async () => {
      jest.spyOn(scholarshipRepo, 'find').mockResolvedValue([]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a single scholarship', async () => {
      const mockScholarship = { id: 'scholarship-1', title: 'STEM Scholarship' };
      jest.spyOn(scholarshipRepo, 'findOne').mockResolvedValue(mockScholarship as any);

      const result = await service.findOne('scholarship-1');

      expect(result).toEqual(mockScholarship);
    });
  });

  describe('create', () => {
    it('should create a scholarship', async () => {
      const mockScholarship = { id: 'scholarship-1', title: 'STEM Scholarship' };
      jest.spyOn(scholarshipRepo, 'create').mockReturnValue(mockScholarship as any);
      jest.spyOn(scholarshipRepo, 'save').mockResolvedValue(mockScholarship as any);

      const result = await service.create({ title: 'STEM Scholarship' });

      expect(mockScholarshipRepo.create).toHaveBeenCalled();
    });
  });
});