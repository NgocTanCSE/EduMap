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
    private readonly donationRepo: Repository<Donation>,
    private readonly dataSource: DataSource,
    private readonly gamificationService: GamificationService,
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
   * Lấy danh sách các nhà hảo tâm của một chiến dịch
   */
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
          fullName: true,
          avatar_url: true,
        }
      }
    });
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
   * F-20: Quyên góp trực tuyến (Đã xử lý Race Condition bằng Transaction & Atomic Update)
   */
  async processDonation(campaignId: string, userId: string | null, amount: number, transactionId?: string) {
    // 1. Kiểm tra dữ liệu đầu vào (Input Validation) - Elite Coder Rule
    if (amount <= 0) {
      throw new BadRequestException('Số tiền quyên góp phải lớn hơn 0');
    }

    // 2. Sử dụng Transaction để đảm bảo tính ACID (Atomicity, Consistency, Isolation, Durability)
    return await this.dataSource.transaction(async (manager) => {
      try {
        // 3. Khóa bản ghi Campaign bằng Pessimistic Write Lock
        // Ngăn chặn các tiến trình khác thay đổi trạng thái hoặc số tiền trong khi đang xử lý
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

        // 4. Tạo bản ghi quyên góp mới
        const donation = manager.create(Donation, {
          campaign_id: campaignId,
          donor_id: userId,
          amount: amount,
          status: 'completed',
          transaction_id: transactionId || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        });
        const savedDonation = await manager.save(donation);

        // 5. Cập nhật số tiền hiện tại bằng lệnh Atomic Increment
        // Lệnh này được thực thi trực tiếp dưới DB: UPDATE campaigns SET current_amount = current_amount + amount
        await manager.increment(DonationCampaign, { id: campaignId }, 'current_amount', amount);

        // Lấy dữ liệu mới nhất sau khi update để trả về cho Client
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
      } catch (error) {
        // Elite Coder: Luôn log lỗi chi tiết, không silent failure
        this.logger.error(`[DONATE FAILED] Campaign: ${campaignId}, Error: ${error.message}`);
        throw error;
      }
    });
  }
}
ite Coder: Luôn log lỗi chi tiết, không silent failure
        this.logger.error(`[DONATE FAILED] Campaign: ${campaignId}, Error: ${error.message}`);
        throw error;
      }
    });
  }
}
