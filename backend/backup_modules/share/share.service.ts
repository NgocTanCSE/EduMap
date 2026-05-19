import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedItem } from './entities/share.entity';

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(SharedItem) private itemRepo: Repository<SharedItem>,
  ) {}

  // 1. Yêu c?u mý?n & Theo d?i v?n chuy?n (Request & Delivery Tracking)
  async requestItem(itemId: string, borrowerId: string) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item || item.status !== 'available') {
      throw new NotFoundException('Tài li?u/H?c c? này hi?n không có s?n ð? mý?n.');
    }

    await this.itemRepo.update(itemId, { status: 'borrowed' });
    
    return {
      success: true,
      message: 'Ð? g?i yêu c?u mý?n thành công!',
      tracking: {
        status: 'pending_pickup',
        estimated_delivery: '2-3 ngày làm vi?c'
      }
    };
  }
}

