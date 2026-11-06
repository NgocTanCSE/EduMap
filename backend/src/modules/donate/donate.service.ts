import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Donation, DonationCampaign } from './entities/donation.entity';
import { GamificationService } from '../gamification/gamification.service';
@Injectable()
export class DonateService {
    private readonly logger = new Logger(DonateService.name);
    constructor(
    @InjectRepository(DonationCampaign)
    private readonly campaignRepo: Repository<DonationCampaign>, 
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>, private readonly dataSource: DataSource, private readonly gamificationService: GamificationService) { }
    async getAllCampaigns() {
        return this.campaignRepo.find({
            order: { created_at: 'DESC' },
        });
    }
    async getCampaignById(id: string) {
        const campaign = await this.campaignRepo.findOne({ where: { id } });
        if (!campaign)
            throw new NotFoundException('Chiến dịch không tồn tại');
        return campaign;
    }
    async getDonorsByCampaignId(campaignId: string) {
        return this.donationRepo.find({
            where: { campaign_id: campaignId, status: 'completed' },
            relations: ['donor'],
            order: { created_at: 'DESC' },
            select: {
                id: true,
                amount: true,
                created_at: true,
                donor: {
                    id: true,
                    full_name: true,
                    avatar_url: true,
                }
            }
        });
    }
    async createCampaign(data: any) {
        const campaign = this.campaignRepo.create({
            ...data,
            current_amount: 0,
            status: 'active',
        });
        return this.campaignRepo.save(campaign);
    }
    async processDonation(campaignId: string, userId: string | null, amount: number, transactionId?: string) {
        if (amount <= 0) {
            throw new BadRequestException('Số tiền quyên góp phải lớn hơn 0');
        }
        return await this.dataSource.transaction(async (manager) => {
            try {
                const campaign = await manager.findOne(DonationCampaign, {
                    where: { id: campaignId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!campaign) {
                    throw new NotFoundException('Chiến dịch quyên góp không tồn tại');
                }
                if (campaign.status !== 'active') {
                    throw new BadRequestException('Chiến dịch này đã đóng hoặc đã kết thúc!');
                }
                const donation = manager.create(Donation, {
                    campaign_id: campaignId,
                    donor_id: userId,
                    amount: amount,
                    status: 'completed',
                    transaction_id: transactionId || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                });
                const savedDonation = await manager.save(donation);
                await manager.increment(DonationCampaign, { id: campaignId }, 'current_amount', amount);
                const updatedCampaign = await manager.findOne(DonationCampaign, { where: { id: campaignId } });
                this.logger.log(`[DONATE SUCCESS] User ${userId || 'Anonymous'} donated ${amount} to ${campaignId}`);
                return {
                    status: 'success',
                    message: 'Cảm ơn bạn đã quyên góp hỗ trợ cộng đồng!',
                    transaction_id: savedDonation.transaction_id,
                    campaign: {
                        id: updatedCampaign.id,
                        title: updatedCampaign.title,
                        current_amount: updatedCampaign.current_amount,
                        target_amount: updatedCampaign.target_amount,
                    },
                };
            }
            catch (error: any) {
                this.logger.error(`[DONATE FAILED] Campaign: ${campaignId}, Error: ${error.message}`);
                throw error;
            }
        });
    }
}
