import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolunteerActivity } from './entities/volunteer.entity';

@Injectable()
export class VolunteerService {
  constructor(
    @InjectRepository(VolunteerActivity) private volRepo: Repository<VolunteerActivity>,
  ) {}

  /**
   * 1. Quản lý chiến dịch & Phân công (Assign & Campaign management)
   */
  async getCampaigns() {
    return this.volRepo.createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: 'active' })
      .orderBy('campaign.created_at', 'DESC')
      .getMany();
  }

  /**
   * 2. Tracking hours & Chứng nhận tự động
   */
  async logVolunteerHours(userId: string, campaignId: string, hours: number) {
    // Thực tế sẽ lưu vào bảng VolunteerLog và cộng dồn
    // Nếu tổng số giờ > 50, tự động kích hoạt MOD-22 (Certificate) cấp chứng chỉ "Công dân tích cực"
    return {
      success: true,
      logged_hours: hours,
      message: `Đã ghi nhận ${hours} giờ tình nguyện. Sắp đạt mốc nhận chứng nhận!`,
      current_total: hours + 45 // Giả lập tổng số giờ
    };
  }
}
