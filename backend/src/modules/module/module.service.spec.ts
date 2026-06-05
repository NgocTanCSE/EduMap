import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModuleService } from './module.service';
import { Module } from './module.entity';
import { Repository } from 'typeorm';

describe('ModuleService', () => {
  let service: ModuleService;
  let repo: Repository<Module>;

  const mockModuleRepository = {
    find: jest.fn().mockResolvedValue([
      { id: 'M1', name: 'Module 1', description: 'Desc 1' },
      { id: 'M2', name: 'Module 2', description: 'Desc 2' },
    ]),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        {
          provide: getRepositoryToken(Module),
          useValue: mockModuleRepository,
        },
      ],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
    repo = module.get<Repository<Module>>(getRepositoryToken(Module));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of modules', async () => {
      const result = await service.findAll();
      expect(result).toEqual([
        { id: 'M1', name: 'Module 1', description: 'Desc 1' },
        { id: 'M2', name: 'Module 2', description: 'Desc 2' },
      ]);
      expect(repo.find).toHaveBeenCalled();
    });
  });
});
