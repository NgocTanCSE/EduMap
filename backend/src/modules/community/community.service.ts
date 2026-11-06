import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Post, Comment, Group } from './entities/community.entity';
import { AIService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class CommunityService {
    private readonly logger = new Logger(CommunityService.name);
    constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>, 
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>, 
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>, private readonly aiService: AIService, private readonly notificationsService: NotificationsService) { }
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
    private async assertContentApproved(userId: string, content: string): Promise<any> {
        let moderationResult: any;
        try {
            moderationResult = await this.aiService.moderateContent(userId, content);
        }
        catch (error: any) {
            this.logger.error(`AI moderation unavailable: ${error?.message || error}`);
            throw new ServiceUnavailableException('Hệ thống kiểm duyệt AI đang tạm thời gián đoạn. Vui lòng thử lại sau.');
        }
        if (moderationResult?.action_taken !== 'APPROVED') {
            const flags = Array.isArray(moderationResult?.flags) && moderationResult.flags.length > 0
                ? `: ${moderationResult.flags.join(', ')}`
                : '.';
            throw new BadRequestException(`Nội dung vi phạm tiêu chuẩn cộng đồng${flags}`);
        }
        return moderationResult;
    }
    async getPosts(page: number = 1, limit: number = 10, search?: string, groupId?: string) {
        const whereCondition: any = { status: 'active' };
        if (groupId) {
            whereCondition.group_id = groupId;
        }
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
    async getPostById(id: string) {
        const post = await this.postRepo.findOne({
            where: { id, status: 'active' },
            relations: ['author', 'group'],
        });
        if (!post)
            throw new NotFoundException('Không tìm thấy bài viết');
        return post;
    }
    async likePost(postId: string, likerId?: string) {
        const post = await this.postRepo.findOne({ where: { id: postId }, relations: ['author'] });
        if (!post || post.status !== 'active')
            throw new NotFoundException('Bài viết không tồn tại hoặc đã bị khóa');
        await this.postRepo.increment({ id: postId }, 'like_count', 1);
        if (likerId && post.author_id !== likerId) {
            await this.notificationsService.sendNotification(post.author_id, `Lượt thích mới! Ai đó vừa thích bài viết của bạn trong cộng đồng EduMap.`, 'in-app');
        }
        return { success: true, message: 'Đã thích bài viết' };
    }
    async addComment(userId: string, postId: string, content: string) {
        const post = await this.postRepo.findOne({ where: { id: postId, status: 'active' }, relations: ['author'] });
        if (!post)
            throw new NotFoundException('Không tìm thấy bài viết');
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
            await this.notificationsService.sendNotification(post.author_id, `Bình luận mới! Bạn có một bình luận mới cho bài viết "${post.title}".`, 'in-app');
        }
        return {
            comment: savedComment,
            moderation_message: moderationResult?.moderation_message || null,
        };
    }
    async getCommentsByPostId(postId: string, page: number = 1, limit: number = 20) {
        const [comments, total] = await this.commentRepo.findAndCount({
            where: { post_id: postId, status: 'active' },
            relations: ['author'],
            order: { created_at: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { comments, total, page, limit };
    }
    async createGroup(userId: string, data: any) {
        const group = this.groupRepo.create({
            ...data,
            owner_id: userId,
        });
        return this.groupRepo.save(group);
    }
    async getGroups() {
        return this.groupRepo.find({
            relations: ['owner'],
            order: { created_at: 'DESC' },
        });
    }
    async joinGroup(userId: string, groupId: string) {
        const group = await this.groupRepo.findOne({ where: { id: groupId } });
        if (!group)
            throw new NotFoundException('Không tìm thấy nhóm học tập');
        return {
            message: `Đã tham gia nhóm học tập "${group.name}" thành công!`,
        };
    }
}
