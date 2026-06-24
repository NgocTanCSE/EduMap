import { Test, TestingModule } from '@nestjs/testing';
import { IntlService } from './intl.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InternationalProgram } from './entities/intl.entity';
import { AlumniNetwork } from './entities/alumni.entity';
import { Repository } from 'typeorm';

describe('IntlService', () => {
  let service: IntlService;
  let programRepo: Repository<InternationalProgram>;
  let alumniRepo: Repository<AlumniNetwork>;

  const mockProgramRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAlumniRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntlService,
        {
          provide: getRepositoryToken(InternationalProgram),
          useValue: mockProgramRepo,
        },
        {
          provide: getRepositoryToken(AlumniNetwork),
          useValue: mockAlumniRepo,
        },
      ],
    }).compile();

    service = module.get<IntlService>(IntlService);
    programRepo = module.get<Repository<InternationalProgram>>(getRepositoryToken(InternationalProgram));
    alumniRepo = module.get<Repository<AlumniNetwork>>(getRepositoryToken(AlumniNetwork));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPrograms', () => {
    it('should return all international programs', async () => {
      jest.spyOn(programRepo, 'find').mockResolvedValue([]);

      const result = await service.getPrograms();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should register user for a program', async () => {
      const mockProgram = { id: 'program-1', title: 'Exchange Program' };
      jest.spyOn(programRepo, 'findOne').mockResolvedValue(mockProgram as any);

      const result = await service.register('user-1', 'program-1');

      expect(result).toHaveProperty('success', true);
    });
  });
});