import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LibraryService } from './library.service';
import { LearningMaterial } from './entities/learning-material.entity';
import { Repository } from 'typeorm';

describe('LibraryService', () => {
  let service: LibraryService;
  let repo: Repository<LearningMaterial>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        {
          provide: getRepositoryToken(LearningMaterial),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
    repo = module.get<Repository<LearningMaterial>>(getRepositoryToken(LearningMaterial));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getResources', () => {
    it('should return array of learning materials', async () => {
      const mockMaterials = [
        { id: 'mat-1', title: 'Python Basics', type: 'ebook' },
        { id: 'mat-2', title: 'React Tutorial', type: 'course' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockMaterials as LearningMaterial[]);

      const result = await service.getResources();

      expect(result).toEqual(mockMaterials);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getResourceById', () => {
    it('should return material when found', async () => {
      const mockMaterial = { id: 'mat-1', title: 'Python Basics', type: 'ebook' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockMaterial as LearningMaterial);

      const result = await service.getResourceById('mat-1');

      expect(result).toEqual(mockMaterial);
    });

    it('should throw error when material not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getResourceById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createResource', () => {
    it('should create new learning material', async () => {
      const mockMaterial = { id: 'mat-1', title: 'New Material', type: 'ebook' };
      jest.spyOn(repo, 'create').mockReturnValue(mockMaterial as LearningMaterial);
      jest.spyOn(repo, 'save').mockResolvedValue(mockMaterial as LearningMaterial);

      const result = await service.createResource({
        title: 'New Material',
        type: 'ebook',
        subject: 'Programming',
        author_id: 'user-1',
      });

      expect(result).toEqual(mockMaterial);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('searchResources', () => {
    it('should return materials matching query', async () => {
      const mockMaterials = [
        { id: 'mat-1', title: 'Python Basics', type: 'ebook' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockMaterials as LearningMaterial[]);

      const result = await service.searchResources('python');

      expect(result).toEqual(mockMaterials);
    });
  });
});
