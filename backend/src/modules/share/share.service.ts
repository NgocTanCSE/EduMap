import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedItem } from './entities/share.entity';
import { BorrowRequest } from './entities/borrow-request.entity';
import { SanitizeService } from './sanitize.service';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(SharedItem) private readonly itemRepo: Repository<SharedItem>,
    @InjectRepository(BorrowRequest) private readonly requestRepo: Repository<BorrowRequest>,
    private readonly sanitizeService: SanitizeService,
  ) {}

  /**
   * Tạo tài nguyên chia sẻ mới
   */
  async createItem(ownerId: string, data: any) {
    const cleanName = this.sanitizeService.clean(data.name);
    const cleanDesc = this.sanitizeService.clean(data.description || '');

    if (!cleanName) {
      throw new BadRequestException('Tên tài liệu/học cụ không hợp lệ');
    }

    const item = this.itemRepo.create({
      name: cleanName,
      category: data.category || 'book',
      description: cleanDesc,
      status: 'available',
      owner_id: ownerId,
    });

    return this.itemRepo.save(item);
  }

  /**
   * Lấy danh sách tài nguyên chia sẻ
   */
  async getItems(category?: string) {
    const whereClause: any = { status: 'available' };
    if (category) {
      whereClause.category = category;
    }
    return this.itemRepo.find({
      where: whereClause,
      relations: ['owner'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Gửi yêu cầu mượn/trao đổi
   */
  async requestItem(itemId: string, borrowerId: string, message: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Không tìm thấy tài liệu/học cụ');

    if (item.status !== 'available') {
      throw new BadRequestException('Tài liệu này hiện không có sẵn.');
    }

    if (item.owner_id === borrowerId) {
      throw new BadRequestException('Bạn không thể tự mượn đồ của chính mình.');
    }

    // Create a borrow request
    const request = this.requestRepo.create({
      item_id: itemId,
      requester_id: borrowerId,
      message: message,
      status: 'pending'
    });

    await this.requestRepo.save(request);

    // Optionally mark item as pending if you want to hide it
    // item.status = 'pending';
    // await this.itemRepo.save(item);

    return {
      success: true,
      message: 'Đã gửi yêu cầu mượn tài liệu thành công!',
      request_id: request.id,
      tracking_code: `EDUSHARE-${request.id.substring(0, 8).toUpperCase()}`
    };
  }

  /**
   * Lấy danh sách yêu cầu mượn của một người dùng
   */
  async getUserBorrowRequests(userId: string) {
    return this.requestRepo.find({
      where: { requester_id: userId },
      relations: ['item', 'item.owner'],
      order: { created_at: 'DESC' }
    });
  }

  /**
   * Trả lại học cụ/sách cho chủ sở hữu
   */
  async returnItem(itemId: string, ownerId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId, owner_id: ownerId } });
    if (!item) throw new NotFoundException('Không tìm thấy học cụ');

    item.status = 'available';
    return this.itemRepo.save(item);
  }
}
