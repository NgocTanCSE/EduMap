import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SummerCampaign } from './entities/summer.entity';
import { SummerRegistration } from './entities/summer-registration.entity';
import { SummerActivity } from './entities/summer-activity.entity';

@Injectable()
export class SummerCampaignService {
  constructor(
    @InjectRepository(SummerCampaign) private readonly campaignRepo: Repository<SummerCampaign>,
    @InjectRepository(SummerRegistration) private readonly registrationRepo: Repository<SummerRegistration>,
    @InjectRepository(SummerActivity) private readonly activityRepo: Repository<SummerActivity>,
  ) {}

  async createCampaign(data: any) {
    const campaign = this.campaignRepo.create({
      ...data,
      status: 'active',
    });
    return this.campaignRepo.save(campaign);
  }

  async getCampaigns() {
    return this.campaignRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Thêm hoạt động hằng ngày vào chiến dịch
   */
  async addActivity(campaignId: string, data: any) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chiến dịch không tồn tại');

    const activity = this.activityRepo.create({
      campaign_id: campaignId,
      ...data
    });
    return this.activityRepo.save(activity);
  }

  /**
   * Báo cáo hoạt động hằng ngày của chiến dịch (Dữ liệu thực)
   */
  async getDailyReport(campaignId: string, date: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chiến dịch Mùa hè xanh không tồn tại');

    const activities = await this.activityRepo.find({
      where: { campaign_id: campaignId, date: date }
    });

    const totalVolunteers = await this.registrationRepo.count({
      where: { campaign_id: campaignId, status: 'approved' }
    });

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      location: campaign.location,
      date: date,
      activities: activities.map(a => ({
        type: a.title,
        hours: a.hours_spent,
        volunteers: a.volunteer_count,
        status: a.status
      })),
      total_volunteers_approved: totalVolunteers,
      activity_count: activities.length,
    };
  }

  async registerVolunteer(campaignId: string, userId: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chiến dịch Mùa hè xanh không tồn tại');

    if (campaign.status !== 'active') {
        throw new BadRequestException('Chiến dịch đã kết thúc, không thể đăng ký thêm.');
    }

    const existing = await this.registrationRepo.findOne({
        where: { user_id: userId, campaign_id: campaignId }
    });

    if (existing) {
        throw new BadRequestException('Bạn đã đăng ký tham gia chiến dịch này rồi.');
    }

    const registration = this.registrationRepo.create({
        user_id: userId,
        campaign_id: campaignId,
        status: 'pending'
    });

    await this.registrationRepo.save(registration);

    return {
      success: true,
      message: `Đăng ký tham gia chiến dịch ${campaign.name} thành công!`,
      campaign_id: campaignId,
      user_id: userId,
      registered_at: registration.created_at,
    };
  }

  /**
   * Phê duyệt tình nguyện viên (Admin/Đội trưởng)
   */
  async updateRegistrationStatus(registrationId: string, status: 'approved' | 'rejected') {
    const reg = await this.registrationRepo.findOne({ where: { id: registrationId } });
    if (!reg) throw new NotFoundException('Yêu cầu đăng ký không tồn tại');
    
    reg.status = status;
    return this.registrationRepo.save(reg);
  }
}
