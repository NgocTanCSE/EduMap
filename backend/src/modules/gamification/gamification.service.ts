import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  private readonly aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(GreenActivity) private activityRepo: Repository<GreenActivity>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Xử lý nộp minh chứng hoạt động Xanh
   */
  async submitActivity(userId: string, data: any) {
    const activity = this.activityRepo.create({
      user_id: userId,
      activity_type: data.type,
      description: data.description,
      proof_url: data.proofUrl,
      status: 'pending',
    });
    
    const saved = await this.activityRepo.save(activity);

    // Gọi AI để tự động xác thực (Async)
    this.verifyWithAI(saved.id);

    return saved;
  }

  /**
   * Gọi AI Service để phân tích hình ảnh
   */
  private async verifyWithAI(activityId: string) {
    const activity = await this.activityRepo.findOne({ where: { id: activityId } });
    if (!activity) return;

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiUrl}/api/ai/verify-green`, { 
          image_url: activity.proof_url,
          type: activity.activity_type 
        })
      );

      const { confidence, is_valid } = response.data;
      activity.ai_confidence = confidence;

      if (is_valid && confidence > 0.8) {
        activity.status = 'approved';
        await this.awardPoints(activity.user_id, 50, `Hoàn thành hoạt động: ${activity.activity_type}`);
      } else if (confidence < 0.3) {
        activity.status = 'rejected';
      } else {
        activity.status = 'flagged'; // Cần Moderator kiểm tra thủ công
      }

      await this.activityRepo.save(activity);
    } catch (error) {
      this.logger.error(`AI Verification failed for activity ${activityId}`);
    }
  }

  /**
   * Cộng điểm và nâng cấp độ
   */
  async awardPoints(userId: string, points: number, reason: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    user.points = (user.points || 0) + points;
    const newLevel = Math.floor(user.points / 500) + 1; // 500 điểm lên 1 cấp
    
    if (newLevel > user.level) {
      user.level = newLevel;
      this.logger.log(`User ${user.email} leveled up to ${newLevel}!`);
    }

    return this.userRepo.save(user);
  }

  /**
   * Lấy danh sách hoạt động chờ duyệt (Cho Moderator)
   */
  async getPendingActivities() {
    return this.activityRepo.find({
      where: { status: 'flagged' },
      order: { created_at: 'DESC' },
      relations: ['user'],
    });
  }
}
