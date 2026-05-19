import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationCampaign } from './entities/donation-campaign.entity';

@Injectable()
export class DonateService {
  private readonly logger = new Logger(DonateService.name);

  constructor(
    @InjectRepository(DonationCampaign)
    private campaignRepo: Repository<DonationCampaign>,
  ) {}

  /**
   * Lấy tất cả chiến dịch đang mở
   */
  async getAllCampaigns() {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết một chiến dịch
   */
  async getCampaignById(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Chiến dịch không tồn tại');
    return campaign;
  }

  /**
   * Xử lý quyên góp
   */
  async processDonation(campaignId: string, userId: string, amount: number) {
    const campaign = await this.getCampaignById(campaignId);

    campaign.currentAmount = (campaign.currentAmount || 0) + amount;
    await this.campaignRepo.save(campaign);

    this.logger.log('`User ${userId} donated ${amount} to campaign ${campaignId}`');

    return {
      status: 'success',
      message: 'Cảm ơn bạn đã quyên góp!',
      campaign: {
        id: campaign.id,
        title: campaign.title,
        currentAmount: campaign.currentAmount,
        targetAmount: campaign.targetAmount,
      },
    };
  }
}
