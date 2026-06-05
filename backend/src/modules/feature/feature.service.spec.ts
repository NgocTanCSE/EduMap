import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureService } from './feature.service';
import { Feature } from './feature.entity';
import { Repository } from 'typeorm';

describe('FeatureService', () => {
  let service: FeatureService;
  let repo: Repository<Feature>;

  const mockFeatureRepository = {
    find: jest.fn().mockResolvedValue([
      { id: 'F1', name: 'Feature 1', description: 'Desc 1', moduleId: 'M1' },
      { id: 'F2', name: 'Feature 2', description: 'Desc 2', moduleId: 'M1' },
    ]),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: getRepositoryToken(Feature),
          useValue: mockFeatureRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    repo = module.get<Repository<Feature>>(getRepositoryToken(Feature));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of features', async () => {
      const result = await service.findAll();
      expect(result).toEqual([
        { id: 'F1', name: 'Feature 1', description: 'Desc 1', moduleId: 'M1' },
        { id: 'F2', name: 'Feature 2', description: 'Desc 2', moduleId: 'M1' },
      ]),
      expect(repo.find).toHaveBeenCalled();
    });
  });
});
