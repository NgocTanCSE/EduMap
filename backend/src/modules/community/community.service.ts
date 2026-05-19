import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, Comment, Group } from './entities/community.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
  ) {}

  /**
   * F-18: Đăng bài thảo luận
   */
  async createPost(userId: string, data: any) {
    const post = this.postRepo.create({
      ...data,
      author_id: userId,
      like_count: 0,
      comment_count: 0,
    });
    return this.postRepo.save(post);
  }

  /**
   * Lấy danh sách tất cả các bài đăng
   */
  async getPosts() {
    return this.postRepo.find({
      relations: ['author', 'group'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-18: Bình luận thảo luận
   */
  async addComment(userId: string, postId: string, content: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    const comment = this.commentRepo.create({
      post_id: postId,
      author_id: userId,
      content,
    });
    await this.commentRepo.save(comment);

    // Tăng số lượng bình luận trên bài đăng
    post.comment_count = Number(post.comment_count || 0) + 1;
    await this.postRepo.save(post);

    return comment;
  }

  /**
   * Lấy tất cả bình luận của một bài đăng
   */
  async getCommentsByPostId(postId: string) {
    return this.commentRepo.find({
      where: { post_id: postId },
      relations: ['author'],
      order: { created_at: 'ASC' },
    });
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
