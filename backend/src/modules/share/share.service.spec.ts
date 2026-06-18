import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShareService } from './share.service';
import { SharedItem } from './entities/share.entity';
import { Repository } from 'typeorm';

describe('ShareService', () => {
  let service: ShareService;
  let repo: Repository<SharedItem>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareService,
        {
          provide: getRepositoryToken(SharedItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ShareService>(ShareService);
    repo = module.get<Repository<SharedItem>>(getRepositoryToken(SharedItem));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getItems', () => {
    it('should return array of shared items', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Python Book', category: 'book', status: 'available' },
        { id: 'item-2', name: 'Laptop', category: 'equipment', status: 'available' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockItems as SharedItem[]);

      const result = await service.getItems();

      expect(result).toEqual(mockItems);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('createItem', () => {
    it('should create new shared item', async () => {
      const mockItem = { id: 'item-1', name: 'New Book', category: 'book', status: 'available' };
      jest.spyOn(repo, 'create').mockReturnValue(mockItem as SharedItem);
      jest.spyOn(repo, 'save').mockResolvedValue(mockItem as SharedItem);

      const result = await service.createItem({
        name: 'New Book',
        category: 'book',
        description: 'A great book',
        owner_id: 'user-1',
      });

      expect(result).toEqual(mockItem);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getItemById', () => {
    it('should return item when found', async () => {
      const mockItem = { id: 'item-1', name: 'Python Book', category: 'book' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockItem as SharedItem);

      const result = await service.getItemById('item-1');

      expect(result).toEqual(mockItem);
    });

    it('should throw error when item not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getItemById('nonexistent')).rejects.toThrow();
    });
  });
});
