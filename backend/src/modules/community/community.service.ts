import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, Comment, Group } from './entities/community.entity';
import { AIService } from '../ai/ai.service'; // Import AIService
import { NotificationsService } from '../notifications/notifications.service'; // Import NotificationsService

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    private readonly aiService: AIService, // Inject AIService
    private readonly notificationsService: NotificationsService, // Inject NotificationsService
  ) {}

  /**
   * Tạo bài thảo luận có kiểm duyệt AI
   */
  async createPost(userId: string, data: any) {
    // 1. Kiểm duyệt nội dung bằng AI
    const moderationResult = await this.aiService.moderateContent(userId, data.content);

    if (moderationResult.action_taken === 'AUTO_REJECTED') {
        throw new BadRequestException(`Nội dung vi phạm tiêu chuẩn cộng đồng: ${moderationResult.flags.join(', ')}`);
    }

    const postStatus = moderationResult.action_taken === 'SEND_TO_HUMAN_REVIEW' ? 'pending_review' : 'active';

    // 2. Lưu bài viết
    const post = this.postRepo.create({
      ...data,
      author_id: userId,
      like_count: 0,
      comment_count: 0,
      status: postStatus,
    });
    
    const savedPost = await this.postRepo.save(post);
    
    return {
        post: savedPost,
        moderation_message: postStatus === 'pending_review' ? 'Bài viết của bạn đang chờ quản trị viên duyệt do có chứa từ ngữ nhạy cảm.' : null
    };
  }

  /**
   * Lấy danh sách tất cả các bài đăng (Có phân trang)
   */
  async getPosts(page: number = 1, limit: number = 10) {
    const [posts, total] = await this.postRepo.findAndCount({
      where: { status: 'active' }, // Chỉ lấy bài đã duyệt
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
            'Lượt thích mới!',
            'Ai đó vừa thích bài viết của bạn trong cộng đồng EduMap.',
            ['in-app']
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

    // 1. Kiểm duyệt nội dung bằng AI
    const moderationResult = await this.aiService.moderateContent(userId, content);

    if (moderationResult.action_taken === 'AUTO_REJECTED') {
        throw new BadRequestException(`Bình luận vi phạm tiêu chuẩn cộng đồng: ${moderationResult.flags.join(', ')}`);
    }

    const commentStatus = moderationResult.action_taken === 'SEND_TO_HUMAN_REVIEW' ? 'pending_review' : 'active';

    // 2. Lưu bình luận
    const comment = this.commentRepo.create({
      post_id: postId,
      author_id: userId,
      content,
      status: commentStatus
    });
    const savedComment = await this.commentRepo.save(comment);

    // 3. Tăng số lượng bình luận an toàn nếu comment được active ngay
    if (commentStatus === 'active') {
        await this.postRepo.increment({ id: postId }, 'comment_count', 1);
        
        // Gửi thông báo cho tác giả bài viết
        if (post.author_id !== userId) {
            await this.notificationsService.sendNotification(
                post.author_id,
                'Bình luận mới!',
                `Bạn có một bình luận mới cho bài viết "${post.title}".`,
                ['in-app']
            );
        }
    }

    return {
        comment: savedComment,
        moderation_message: commentStatus === 'pending_review' ? 'Bình luận của bạn đang chờ duyệt.' : null
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

  // --- MODERATION LOGIC ---

  /**
   * Lấy danh sách bài viết chờ duyệt
   */
  async getPendingPosts() {
    return this.postRepo.find({
      where: { status: 'pending_review' },
      relations: ['author'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Duyệt hoặc từ chối bài viết
   */
  async moderatePost(postId: string, action: 'approve' | 'reject') {
    const post = await this.postRepo.findOne({ where: { id: postId, status: 'pending_review' } });
    if (!post) throw new NotFoundException('Bài viết không tồn tại hoặc đã được xử lý');

    post.status = action === 'approve' ? 'active' : 'rejected';
    await this.postRepo.save(post);
    
    return { success: true, message: action === 'approve' ? 'Đã duyệt bài viết' : 'Đã từ chối bài viết' };
  }

  /**
   * Lấy danh sách bình luận chờ duyệt
   */
  async getPendingComments() {
    return this.commentRepo.find({
      where: { status: 'pending_review' },
      relations: ['author', 'post'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Duyệt hoặc từ chối bình luận
   */
  async moderateComment(commentId: string, action: 'approve' | 'reject') {
    const comment = await this.commentRepo.findOne({ where: { id: commentId, status: 'pending_review' } });
    if (!comment) throw new NotFoundException('Bình luận không tồn tại hoặc đã được xử lý');

    comment.status = action === 'approve' ? 'active' : 'rejected';
    await this.commentRepo.save(comment);

    if (action === 'approve') {
       await this.postRepo.increment({ id: comment.post_id }, 'comment_count', 1);
    }
    
    return { success: true, message: action === 'approve' ? 'Đã duyệt bình luận' : 'Đã từ chối bình luận' };
  }
}
