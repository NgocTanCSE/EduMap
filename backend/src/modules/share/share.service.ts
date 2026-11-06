import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SharedItem } from './entities/share.entity';
import { BorrowRequest } from './entities/borrow-request.entity';
import { SanitizeService } from './sanitize.service';
@Injectable()
export class ShareService {
    constructor(
    @InjectRepository(SharedItem)
    private readonly itemRepo: Repository<SharedItem>, 
    @InjectRepository(BorrowRequest)
    private readonly requestRepo: Repository<BorrowRequest>, private readonly sanitizeService: SanitizeService) { }
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
    async requestItem(itemId: string, borrowerId: string, message: string) {
        const item = await this.itemRepo.findOne({ where: { id: itemId } });
        if (!item)
            throw new NotFoundException('Không tìm thấy tài liệu/học cụ');
        if (item.status !== 'available') {
            throw new BadRequestException('Tài liệu này hiện không có sẵn.');
        }
        if (item.owner_id === borrowerId) {
            throw new BadRequestException('Bạn không thể tự mượn đồ của chính mình.');
        }
        const request = this.requestRepo.create({
            item_id: itemId,
            requester_id: borrowerId,
            message: message,
            status: 'pending'
        });
        await this.requestRepo.save(request);
        return {
            success: true,
            message: 'Đã gửi yêu cầu mượn tài liệu thành công!',
            request_id: request.id,
            tracking_code: `EDUSHARE-${request.id.substring(0, 8).toUpperCase()}`
        };
    }
    async getUserBorrowRequests(userId: string) {
        return this.requestRepo.find({
            where: { requester_id: userId },
            relations: ['item', 'item.owner'],
            order: { created_at: 'DESC' }
        });
    }
    async returnItem(itemId: string, ownerId: string) {
        const item = await this.itemRepo.findOne({ where: { id: itemId, owner_id: ownerId } });
        if (!item)
            throw new NotFoundException('Không tìm thấy học cụ');
        item.status = 'available';
        return this.itemRepo.save(item);
    }
}
