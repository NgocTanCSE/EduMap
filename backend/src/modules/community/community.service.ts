import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Post, Comment, Group } from './entities/community.entity';
import { AIService } from '../ai/ai.service'; // Import AIService
import { NotificationsService } from '../notifications/notifications.service'; // Import NotificationsService

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    private readonly aiService: AIService, // Inject AIService
    private readonly notificationsService: NotificationsService, // Inject NotificationsService
  ) {}

  /**
   * Tạo bài thảo luận có kiểm duyệt AI.
   * AI là bước kiểm duyệt cuối cùng: APPROVED => đăng ngay, còn lại => từ chối.
   */
  async createPost(userId: string, data: any) {
    const moderationResult = await this.assertContentApproved(userId, data.content);

    const post = this.postRepo.create({
      ...data,
      author_id: userId,
      like_count: 0,
      comment_count: 0,
      status: 'active',
    });

    return {
      post: await this.postRepo.save(post),
      moderation_message: moderationResult?.moderation_message || null,
    };
  }

  /**
   * Gọi AI kiểm duyệt và chỉ cho phép nội dung được AI đánh dấu APPROVED.
   * Nếu AI không sẵn sàng, nội dung vẫn được phép nếu đã qua lớp lọc regex
   * Layer 1 (profanity + PII) — trả về kết quả với moderation_message để
   * caller biết trạng thái kiểm duyệt.
   */
  private async assertContentApproved(userId: string, content: string): Promise<any> {
    let moderationResult: any;

    try {
      moderationResult = await this.aiService.moderateContent(userId, content);
    } catch (error: any) {
      this.logger.error(`AI moderation unavailable: ${error?.message || error}`);
      throw new ServiceUnavailableException(
        'Hệ thống kiểm duyệt AI đang tạm thời gián đoạn. Vui lòng thử lại sau.',
      );
    }

    if (moderationResult?.action_taken !== 'APPROVED') {
      const flags = Array.isArray(moderationResult?.flags) && moderationResult.flags.length > 0
        ? `: ${moderationResult.flags.join(', ')}`
        : '.';
      throw new BadRequestException(`Nội dung vi phạm tiêu chuẩn cộng đồng${flags}`);
    }

    return moderationResult;
  }

/**
    * Lấy danh sách tất cả các bài đăng (Có phân trang và tìm kiếm)
    */
  async getPosts(page: number = 1, limit: number = 10, search?: string, groupId?: string) {
    const whereCondition: any = { status: 'active' };

    if (groupId) {
      whereCondition.group_id = groupId;
    }

    // `search` was accepted by this method but never applied. Match it against
    // both the title and body so the community search box filters server-side
    // instead of only the handful of posts already loaded in the browser.
    const term = search?.trim();
    const where = term
      ? [
          { ...whereCondition, title: Like(`%${term}%`) },
          { ...whereCondition, content: Like(`%${term}%`) },
        ]
      : whereCondition;

    const [posts, total] = await this.postRepo.findAndCount({
      where,
      relations: ['author', 'group'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { posts, total, page, limit };
  }

  /**
   * Lấy chi tiết một bài đăng
   */
  async getPostById(id: string) {
    const post = await this.postRepo.findOne({
      where: { id, status: 'active' },
      relations: ['author', 'group'],
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  /**
   * Tăng lượt thích an toàn (Tránh Race Condition)
   */
  async likePost(postId: string, likerId?: string) {
    const post = await this.postRepo.findOne({ where: { id: postId }, relations: ['author'] });
    if (!post || post.status !== 'active') throw new NotFoundException('Bài viết không tồn tại hoặc đã bị khóa');

    await this.postRepo.increment({ id: postId }, 'like_count', 1);

    // Gửi thông báo cho tác giả bài viết
    if (likerId && post.author_id !== likerId) {
        await this.notificationsService.sendNotification(
            post.author_id,
            `Lượt thích mới! Ai đó vừa thích bài viết của bạn trong cộng đồng EduMap.`,
            'in-app'
        );
    }

    return { success: true, message: 'Đã thích bài viết' };
  }

  /**
   * Bình luận thảo luận có kiểm duyệt AI
   */
  async addComment(userId: string, postId: string, content: string) {
    const post = await this.postRepo.findOne({ where: { id: postId, status: 'active' }, relations: ['author'] });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    const moderationResult = await this.assertContentApproved(userId, content);

    const comment = this.commentRepo.create({
      post_id: postId,
      author_id: userId,
      content,
      status: 'active',
    });
    const savedComment = await this.commentRepo.save(comment);

    await this.postRepo.increment({ id: postId }, 'comment_count', 1);

    if (post.author_id !== userId) {
      await this.notificationsService.sendNotification(
        post.author_id,
        `Bình luận mới! Bạn có một bình luận mới cho bài viết "${post.title}".`,
        'in-app',
      );
    }

    return {
      comment: savedComment,
      moderation_message: moderationResult?.moderation_message || null,
    };
  }

  /**
   * Lấy tất cả bình luận của một bài đăng (Có phân trang)
   */
  async getCommentsByPostId(postId: string, page: number = 1, limit: number = 20) {
    const [comments, total] = await this.commentRepo.findAndCount({
      where: { post_id: postId, status: 'active' }, // Chỉ lấy comment đã duyệt
      relations: ['author'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return { comments, total, page, limit };
  }

  /**
   * Tạo nhóm học tập mới
   */
  async createGroup(userId: string, data: any) {
    const group = this.groupRepo.create({
      ...data,
      owner_id: userId,
    });
    return this.groupRepo.save(group);
  }

  /**
   * Lấy danh sách nhóm học tập
   */
  async getGroups() {
    return this.groupRepo.find({
      relations: ['owner'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Tham gia nhóm học tập
   */
  async joinGroup(userId: string, groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm học tập');
    return {
      message: `Đã tham gia nhóm học tập "${group.name}" thành công!`,
    };
  }
}
