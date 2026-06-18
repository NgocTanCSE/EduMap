import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StorageService } from './storage.service';
import { UserFile } from './entities/user-file.entity';
import { Repository } from 'typeorm';

describe('StorageService', () => {
  let service: StorageService;
  let repo: Repository<UserFile>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(UserFile),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    repo = module.get<Repository<UserFile>>(getRepositoryToken(UserFile));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserFiles', () => {
    it('should return array of user files', async () => {
      const mockFiles = [
        { id: 'file-1', name: 'document.pdf', user_id: 'user-1' },
        { id: 'file-2', name: 'image.jpg', user_id: 'user-1' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockFiles as UserFile[]);

      const result = await service.getUserFiles('user-1');

      expect(result).toEqual(mockFiles);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    it('should create new file record', async () => {
      const mockFile = { id: 'file-1', name: 'new-file.pdf', user_id: 'user-1' };
      jest.spyOn(repo, 'create').mockReturnValue(mockFile as UserFile);
      jest.spyOn(repo, 'save').mockResolvedValue(mockFile as UserFile);

      const result = await service.uploadFile({
        name: 'new-file.pdf',
        user_id: 'user-1',
        file_size: 1024,
        mime_type: 'application/pdf',
      });

      expect(result).toEqual(mockFile);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete file record', async () => {
      const mockFile = { id: 'file-1', name: 'file-to-delete.pdf', user_id: 'user-1' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockFile as UserFile);
      jest.spyOn(repo, 'delete').mockResolvedValue(undefined);

      await service.deleteFile('file-1', 'user-1');

      expect(repo.delete).toHaveBeenCalled();
    });

    it('should throw error when file not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.deleteFile('nonexistent', 'user-1')).rejects.toThrow();
    });
  });
});
