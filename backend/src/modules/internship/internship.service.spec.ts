import { Test, TestingModule } from '@nestjs/testing';
import { InternshipService } from './internship.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Internship } from './entities/internship.entity';
import { Repository } from 'typeorm';

describe('InternshipService', () => {
  let service: InternshipService;
  let internshipRepo: Repository<Internship>;

  const mockInternshipRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternshipService,
        {
          provide: getRepositoryToken(Internship),
          useValue: mockInternshipRepo,
        },
      ],
    }).compile();

    service = module.get<InternshipService>(InternshipService);
    internshipRepo = module.get<Repository<Internship>>(getRepositoryToken(Internship));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all internships', async () => {
      jest.spyOn(internshipRepo, 'find').mockResolvedValue([]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a single internship', async () => {
      const mockInternship = { id: 'internship-1', title: 'Software Engineer Intern' };
      jest.spyOn(internshipRepo, 'findOne').mockResolvedValue(mockInternship as any);

      const result = await service.findOne('internship-1');

      expect(result).toEqual(mockInternship);
    });
  });

  describe('create', () => {
    it('should create an internship', async () => {
      const mockInternship = {
        id: 'internship-1',
        title: 'Software Engineer Intern',
        company_id: 'company-1',
      };
      jest.spyOn(internshipRepo, 'create').mockReturnValue(mockInternship as any);
      jest.spyOn(internshipRepo, 'save').mockResolvedValue(mockInternship as any);

      const result = await service.create({
        title: 'Software Engineer Intern',
        company_id: 'company-1',
      });

      expect(mockInternshipRepo.create).toHaveBeenCalled();
    });
  });
});