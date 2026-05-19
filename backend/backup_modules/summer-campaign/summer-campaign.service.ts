import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SummerCampaign } from './entities/summer.entity';

@Injectable()
export class SummerCampaignService {
  constructor(
    @InjectRepository(SummerCampaign) private campaignRepo: Repository<SummerCampaign>,
  ) {}

  // 1. Báo cáo ho?t ð?ng h?ng ngày (Daily Reports)
  async getDailyReport(campaignId: string, date: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Chi?n d?ch Mùa hè xanh không t?n t?i');

    // Gom nhóm d? li?u tracking activity trong ngày
    return {
      campaign_name: campaign.name,
      date: date,
      activities: [
        { type: 'D?y h?c', hours: 15, volunteers: 5 },
        { type: 'S?a ðý?ng', hours: 20, volunteers: 10 }
      ],
      total_volunteers_active: 15
    };
  }
}

