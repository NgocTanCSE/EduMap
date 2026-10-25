import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of } from 'rxjs';
import { CommunityService } from './community.service';
import { AIService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Post, Comment, Group } from './entities/community.entity';

describe('CommunityService', () => {
  let service: CommunityService;
  let aiService: jest.Mocked<AIService>;
  let postRepo: jest.Mocked<Repository<Post>>;
  let commentRepo: jest.Mocked<Repository<Comment>>;
  let groupRepo: jest.Mocked<Repository<Group>>;

  beforeEach(async () => {
    postRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      increment: jest.fn(),
    } as unknown as jest.Mocked<Repository<Post>>;

    commentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<Comment>>;

    groupRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Group>>;

    aiService = {
      moderateContent: jest.fn(),
      search: jest.fn(),
      getUserHistory: jest.fn(),
      triggerKnowledgeSync: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    const notificationsService = {
      sendNotification: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: getRepositoryToken(Post), useValue: postRepo },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Group), useValue: groupRepo },
        { provide: AIService, useValue: aiService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  describe('createPost', () => {
    it('should create a post when AI moderation approves content', async () => {
      const moderationResult: any = {
        status: 'Processed via AI Service',
        is_safe: true,
        confidence: 0.95,
        flags: [],
        action_taken: 'APPROVED',
        moderation_message: null,
      };
      aiService.moderateContent.mockResolvedValue(moderationResult);

      const postData = { title: 'Hỏi về bài tập', content: 'Có ai biết cách làm bài 2 không?' };
      const savedPost: any = { id: 'post-1', ...postData, author_id: 'user-1', like_count: 0, comment_count: 0, status: 'active' };
      postRepo.create.mockReturnValue(savedPost);
      postRepo.save.mockResolvedValue(savedPost);

      const result = await service.createPost('user-1', postData);

      expect(aiService.moderateContent).toHaveBeenCalledWith('user-1', postData.content);
      expect(result.post).toEqual(savedPost);
      expect(result.moderation_message).toBeNull();
    });

    it('should pass through moderation_message from the AI service', async () => {
      const moderationResult: any = {
        status: 'Processed via AI Service (degraded — regex fallback)',
        is_safe: true,
        confidence: 0.3,
        flags: [],
        action_taken: 'APPROVED',
        moderation_message: 'AI unavailable — passed regex pre-filter only',
      };
      aiService.moderateContent.mockResolvedValue(moderationResult);

      const postData = { title: 'Hỏi về bài tập', content: 'Câu hỏi khó quá' };
      const savedPost: any = { id: 'post-1', ...postData, author_id: 'user-1', like_count: 0, comment_count: 0, status: 'active' };
      postRepo.create.mockReturnValue(savedPost);
      postRepo.save.mockResolvedValue(savedPost);

      const result = await service.createPost('user-1', postData);

      expect(result.moderation_message).toBe('AI unavailable — passed regex pre-filter only');
    });

    it('should reject content flagged as unsafe by AI', async () => {
      const moderationResult: any = {
        status: 'Processed via AI Service',
        is_safe: false,
        confidence: 0.9,
        flags: ['Spam'],
        action_taken: 'AUTO_REJECTED',
        moderation_message: null,
      };
      aiService.moderateContent.mockResolvedValue(moderationResult);

      await expect(
        service.createPost('user-1', { title: 'Spam', content: 'Mua ngay!' }),
      ).rejects.toThrow(/vi phạm tiêu chuẩn cộng đồng/);
    });

    it('should throw ServiceUnavailableException when AI service is down', async () => {
      aiService.moderateContent.mockRejectedValue(
        new Error('AI Content moderation service is currently unavailable.'),
      );

      await expect(
        service.createPost('user-1', { title: 'test', content: 'test' }),
      ).rejects.toThrow(/Hệ thống kiểm duyệt AI đang tạm thời gián đoạn/);
    });
  });

  describe('addComment', () => {
    it('should create a comment when AI moderation approves content', async () => {
      const moderationResult: any = {
        status: 'Processed via AI Service',
        is_safe: true,
        confidence: 0.95,
        flags: [],
        action_taken: 'APPROVED',
        moderation_message: null,
      };
      aiService.moderateContent.mockResolvedValue(moderationResult);

      const fakePost: any = { id: 'post-1', title: 'Bài viết', author_id: 'other-user', status: 'active' };
      postRepo.findOne.mockResolvedValue(fakePost);
      const savedComment: any = { id: 'cmt-1', post_id: 'post-1', author_id: 'user-1', content: 'Hay quá!', status: 'active' };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);
      postRepo.increment.mockResolvedValue({} as any);

      const result = await service.addComment('user-1', 'post-1', 'Bình luận hay');

      expect(aiService.moderateContent).toHaveBeenCalledWith('user-1', 'Bình luận hay');
      expect(result.comment).toEqual(savedComment);
      expect(result.moderation_message).toBeNull();
    });

    it('should pass through moderation_message in addComment', async () => {
      const moderationResult: any = {
        status: 'Processed via AI Service (degraded)',
        is_safe: true,
        confidence: 0.3,
        flags: [],
        action_taken: 'APPROVED',
        moderation_message: 'Degraded: regex fallback',
      };
      aiService.moderateContent.mockResolvedValue(moderationResult);

      const fakePost: any = { id: 'post-1', title: 'Bài viết', author_id: 'other-user', status: 'active' };
      postRepo.findOne.mockResolvedValue(fakePost);
      commentRepo.create.mockReturnValue({} as any);
      commentRepo.save.mockResolvedValue({} as any);
      postRepo.increment.mockResolvedValue({} as any);

      const result = await service.addComment('user-1', 'post-1', 'Bình luận');

      expect(result.moderation_message).toBe('Degraded: regex fallback');
    });
  });
});
