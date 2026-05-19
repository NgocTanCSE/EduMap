import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post, Comment } from './entities/community.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post) private postRepo: Repository<Post>,
    @InjectRepository(Comment) private commentRepo: Repository<Comment>,
  ) {}

  // F-18: Ðãng bài & B?nh lu?n
  async createPost(userId: string, data: any) {
    const post = this.postRepo.create({ ...data, author_id: userId, likes_count: 0, comments_count: 0 });
    return this.postRepo.save(post);
  }

  async addComment(userId: string, postId: string, content: string) {
    const comment = this.commentRepo.create({ post_id: postId, author_id: userId, content });
    await this.postRepo.increment({ id: postId }, 'comments_count', 1);
    return this.commentRepo.save(comment);
  }
}

