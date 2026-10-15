import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { CreateBookmarkDto } from './dto/bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark) private readonly bookmarkRepo: Repository<Bookmark>,
  ) {}

  /** Danh sách bookmark của user, tùy chọn lọc theo loại */
  async listBookmarks(userId: string, targetType?: string): Promise<Bookmark[]> {
    const where: Record<string, any> = { userId };
    if (targetType) where.targetType = targetType;
    return this.bookmarkRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** Bật/tắt bookmark — trả về trạng thái mới (true = đã lưu) */
  async toggleBookmark(userId: string, dto: CreateBookmarkDto): Promise<boolean> {
    const existing = await this.bookmarkRepo.findOne({
      where: {
        userId,
        targetType: dto.target_type,
        targetId: dto.target_id,
      },
    });

    if (existing) {
      await this.bookmarkRepo.remove(existing);
      return false;
    }

    await this.bookmarkRepo.insert({
      userId,
      targetType: dto.target_type,
      targetId: dto.target_id,
    });
    return true;
  }
}
