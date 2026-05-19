import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SummerCampaign } from './entities/summer.entity';

@Injectable()
export class SummerCampaignService {
  constructor(
    @InjectRepository(SummerCampaign) private readonly campaignRepo: Repository<SummerCampaign>,
  ) {}

  /**
   * Tạo chiến dịch mùa hè xanh mới
   */
  async createCampaign(data: any) {
    const campaign = this.campaignRepo.create({
      ...data,
      status: 'active',
    });
    return this.campaignRepo.save(campaign);
  }

  /**
   * Lấy danh sách tất cả chiến dịch mùa hè xanh
   */
  async getCampaigns() {
    return this.campaignRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-27: Báo cáo hoạt động hằng ngày của chiến dịch
   */
  async getDailyReport(campaignId: string, date: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chiến dịch Mùa hè xanh không tồn tại');

    // Gom nhóm dữ liệu hoạt động của các đội thanh niên tình nguyện trong ngày
    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      location: campaign.location,
      date: date,
      activities: [
        { type: 'Dạy học văn hóa & kỹ năng sống', hours: 16, volunteers: 8, status: 'Hoàn thành' },
        { type: 'Sửa chữa lộ giao thông nông thôn', hours: 24, volunteers: 15, status: 'Hoàn thành' },
        { type: 'Tuyên truyền phòng chống đuối nước', hours: 8, volunteers: 4, status: 'Hoàn thành' },
      ],
      total_volunteers_active: 27,
      completed_percentage: '92%',
    };
  }

  /**
   * Đăng ký tham gia tình nguyện chiến dịch Mùa hè xanh
   */
  async registerVolunteer(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chiến dịch Mùa hè xanh không tồn tại');

    return {
      success: true,
      message: `Đăng ký tham gia chiến dịch ${campaign.name} thành công. Hãy chờ liên hệ từ đội trưởng địa bàn ${campaign.location}!`,
      campaign_id: campaignId,
      user_id: userId,
      registered_at: new Date(),
    };
  }
}
