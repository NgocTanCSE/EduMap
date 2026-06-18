import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityService } from './community.service';
import { Post } from './entities/community.entity';
import { Repository } from 'typeorm';

describe('CommunityService', () => {
  let service: CommunityService;
  let repo: Repository<Post>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: getRepositoryToken(Post),
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

    service = module.get<CommunityService>(CommunityService);
    repo = module.get<Repository<Post>>(getRepositoryToken(Post));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPosts', () => {
    it('should return array of posts', async () => {
      const mockPosts = [
        { id: 'post-1', title: 'First Post', content: 'Content 1' },
        { id: 'post-2', title: 'Second Post', content: 'Content 2' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockPosts as Post[]);

      const result = await service.getPosts();

      expect(result).toEqual(mockPosts);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('createPost', () => {
    it('should create new post', async () => {
      const mockPost = { id: 'post-1', title: 'New Post', content: 'Content' };
      jest.spyOn(repo, 'create').mockReturnValue(mockPost as Post);
      jest.spyOn(repo, 'save').mockResolvedValue(mockPost as Post);

      const result = await service.createPost({
        title: 'New Post',
        content: 'Content',
        author_id: 'user-1',
      });

      expect(result).toEqual(mockPost);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getPostById', () => {
    it('should return post when found', async () => {
      const mockPost = { id: 'post-1', title: 'First Post', content: 'Content 1' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockPost as Post);

      const result = await service.getPostById('post-1');

      expect(result).toEqual(mockPost);
    });

    it('should throw error when post not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getPostById('nonexistent')).rejects.toThrow();
    });
  });

  describe('likePost', () => {
    it('should increment like count', async () => {
      const mockPost = { id: 'post-1', like_count: 5 };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockPost as Post);
      jest.spyOn(repo, 'save').mockResolvedValue({ ...mockPost, like_count: 6 } as Post);

      const result = await service.likePost('post-1');

      expect(result.like_count).toBe(6);
    });
  });
});
