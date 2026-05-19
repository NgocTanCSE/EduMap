import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedItem } from './entities/share.entity';
import { SanitizeService } from './sanitize.service';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(SharedItem) private readonly itemRepo: Repository<SharedItem>,
    private readonly sanitizeService: SanitizeService,
  ) {}

  /**
   * Tạo tài nguyên chia sẻ mới (Sử dụng SanitizeService chống mã độc XSS)
   */
  async createItem(ownerId: string, data: any) {
    const cleanName = this.sanitizeService.clean(data.name);
    const cleanDesc = this.sanitizeService.clean(data.description || '');

    if (!cleanName) {
      throw new BadRequestException('Tên tài liệu/học cụ không hợp lệ');
    }

    const item = this.itemRepo.create({
      name: cleanName,
      category: data.category,
      description: cleanDesc,
      status: 'available',
      owner_id: ownerId,
    });

    return this.itemRepo.save(item);
  }

  /**
   * Lấy danh sách tài nguyên chia sẻ (Có phân loại học cụ)
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
   * F-28: Yêu cầu mượn học cụ & tài liệu + Tạo mã Tracking vận chuyển
   */
  async requestItem(itemId: string, borrowerId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Không tìm thấy tài liệu/học cụ tương ứng');
    }

    if (item.status !== 'available') {
      throw new BadRequestException('Tài liệu/học cụ này hiện không có sẵn để mượn.');
    }

    if (item.owner_id === borrowerId) {
      throw new BadRequestException('Bạn không thể tự mượn tài liệu/học cụ của chính mình.');
    }

    item.status = 'borrowed';
    await this.itemRepo.save(item);

    return {
      success: true,
      message: 'Đã gửi yêu cầu mượn tài liệu/học cụ thành công!',
      tracking: {
        item_id: item.id,
        item_name: item.name,
        status: 'pending_pickup',
        borrower_id: borrowerId,
        estimated_delivery: '2-3 ngày làm việc',
        tracking_code: `EDUSHARE-${item.id.substring(0, 8).toUpperCase()}`,
      },
    };
  }

  /**
   * Trả lại học cụ/sách cho chủ sở hữu
   */
  async returnItem(itemId: string, ownerId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId, owner_id: ownerId } });
    if (!item) {
      throw new NotFoundException('Không tìm thấy học cụ tương ứng hoặc bạn không sở hữu học cụ này');
    }

    item.status = 'available';
    return this.itemRepo.save(item);
  }
}
