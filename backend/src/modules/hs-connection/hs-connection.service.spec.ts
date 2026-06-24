import { Test, TestingModule } from '@nestjs/testing';
import { HsConnectionService } from './hs-connection.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HsQa } from './entities/hs-qa.entity';
import { StudentConnection } from './entities/student-connection.entity';
import { Repository } from 'typeorm';

describe('HsConnectionService', () => {
  let service: HsConnectionService;
  let qaRepo: Repository<HsQa>;
  let connectionRepo: Repository<StudentConnection>;

  const mockQaRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockConnectionRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HsConnectionService,
        {
          provide: getRepositoryToken(HsQa),
          useValue: mockQaRepo,
        },
        {
          provide: getRepositoryToken(StudentConnection),
          useValue: mockConnectionRepo,
        },
      ],
    }).compile();

    service = module.get<HsConnectionService>(HsConnectionService);
    qaRepo = module.get<Repository<HsQa>>(getRepositoryToken(HsQa));
    connectionRepo = module.get<Repository<StudentConnection>>(getRepositoryToken(StudentConnection));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllQuestions', () => {
    it('should return all QA questions', async () => {
      jest.spyOn(qaRepo, 'find').mockResolvedValue([]);

      const result = await service.findAllQuestions();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createQuestion', () => {
    it('should create a question', async () => {
      const mockQuestion = { id: 'qa-1', content: 'Câu hỏi mẫu' };
      jest.spyOn(qaRepo, 'create').mockReturnValue(mockQuestion as any);
      jest.spyOn(qaRepo, 'save').mockResolvedValue(mockQuestion as any);

      const result = await service.createQuestion({ content: 'Câu hỏi mẫu' }, 'user-1');

      expect(mockQaRepo.create).toHaveBeenCalled();
    });
  });

  describe('getUserNetwork', () => {
    it('should return user connections', async () => {
      jest.spyOn(connectionRepo, 'find').mockResolvedValue([]);

      const result = await service.getUserNetwork('user-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});