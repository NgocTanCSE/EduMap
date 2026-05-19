import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Donation, DonationCampaign } from './entities/donation.entity';

@Injectable()
export class DonateService {
  private readonly logger = new Logger(DonateService.name);

  constructor(
    @InjectRepository(DonationCampaign)
    private readonly campaignRepo: Repository<DonationCampaign>,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
  ) {}

  /**
   * Lấy danh sách tất cả chiến dịch quyên góp
   */
  async getAllCampaigns() {
    return this.campaignRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết chiến dịch quyên góp theo ID
   */
  async getCampaignById(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Chiến dịch không tồn tại');
    return campaign;
  }

  /**
   * Tạo chiến dịch quyên góp mới (Dành cho Quản trị viên/Trường học)
   */
  async createCampaign(data: any) {
    const campaign = this.campaignRepo.create({
      ...data,
      current_amount: 0,
      status: 'active',
    });
    return this.campaignRepo.save(campaign);
  }

  /**
   * F-20: Quyên góp trực tuyến
   */
  async processDonation(campaignId: string, userId: string | null, amount: number, transactionId?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Số tiền quyên góp phải lớn hơn 0');
    }

    const campaign = await this.getCampaignById(campaignId);
    if (campaign.status !== 'active') {
      throw new BadRequestException('Chiến dịch này đã đóng hoặc đã kết thúc!');
    }

    // 1. Tạo bản ghi quyên góp mới
    const donation = this.donationRepo.create({
      campaign_id: campaignId,
      donor_id: userId,
      amount: amount,
      status: 'completed',
      transaction_id: transactionId || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    await this.donationRepo.save(donation);

    // 2. Cập nhật tiến độ tài chính của chiến dịch quyên góp
    // Convert to float first to avoid string concatenation if database returns string type decimal
    campaign.current_amount = Number(campaign.current_amount) + Number(amount);
    await this.campaignRepo.save(campaign);

    this.logger.log(`User ${userId || 'Anonymous'} donated ${amount} VND to campaign ${campaignId}`);

    return {
      status: 'success',
      message: 'Cảm ơn bạn đã quyên góp hỗ trợ cộng đồng!',
      transaction_id: donation.transaction_id,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        current_amount: campaign.current_amount,
        target_amount: campaign.target_amount,
      },
    };
  }
}
