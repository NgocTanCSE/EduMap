import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { UserPoint, Badge, UserBadge } from './entities/gamification.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  private readonly aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(GreenActivity) private activityRepo: Repository<GreenActivity>,
    @InjectRepository(UserPoint) private pointRepo: Repository<UserPoint>,
    @InjectRepository(Badge) private badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private userBadgeRepo: Repository<UserBadge>,
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cộng điểm, nâng cấp độ và tặng huy hiệu (Gamification Engine)
   */
  async awardPoints(userId: string, points: number, actionCode: string, sourceType: string = 'system', referenceId?: string) {
    if (points <= 0) return null;

    return await this.dataSource.transaction(async (manager) => {
      try {
        // 1. Idempotency Check (Chống cộng điểm lặp lại cho cùng 1 hành động cụ thể)
        if (referenceId) {
          const existingPoint = await manager.findOne(UserPoint, {
            where: { user_id: userId, action: actionCode, reference_id: referenceId },
          });
          if (existingPoint) {
            this.logger.warn(`[IDEMPOTENCY HIT] User ${userId} already received points for ${actionCode} (${referenceId})`);
            return null; // Đã nhận điểm rồi, bỏ qua
          }
        }

        // 2. Khóa bản ghi User để đảm bảo tính nhất quán của Level
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!user) {
          throw new NotFoundException('Người dùng không tồn tại');
        }

        // 3. Daily Cap (Chống gian lận - Giới hạn điểm mỗi ngày)
        // Lấy tổng điểm trong ngày
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { totalPointsToday } = await manager.createQueryBuilder(UserPoint, 'up')
          .select('SUM(up.points)', 'totalPointsToday')
          .where('up.user_id = :userId', { userId })
          .andWhere('up.created_at >= :today', { today })
          .getRawOne();
        
        const dailyCap = 2000; // Giới hạn 2000 điểm mỗi ngày
        if (Number(totalPointsToday) + points > dailyCap) {
             this.logger.warn(`[DAILY CAP REACHED] User ${userId} exceeded daily limit`);
             return null;
        }

        // 4. Ghi lịch sử nhận điểm (Audit Log)
        const pointLog = manager.create(UserPoint, {
          user_id: userId,
          points: points,
          action: actionCode,
          reference_id: referenceId || null,
          source_type: sourceType,
        });
        await manager.save(pointLog);

        // 5. Cập nhật tổng điểm
        await manager.increment(User, { id: userId }, 'points', points);

        // 6. Tính toán Level mới
        const updatedPoints = Number(user.points) + points;
        const newLevel = Math.floor(updatedPoints / 500) + 1;
        let leveledUp = false;

        if (newLevel > user.level) {
          await manager.update(User, { id: userId }, { level: newLevel });
          leveledUp = true;
          this.logger.log(`[LEVEL UP] User ${user.email} reached level ${newLevel}`);
        }

        // 7. Cấp huy hiệu tự động (Auto-Badge Logic)
        const newBadges = await this.checkAndAwardBadges(manager, userId, updatedPoints, sourceType);

        return {
          points_added: points,
          new_total: updatedPoints,
          new_level: newLevel,
          leveled_up: leveledUp,
          new_badges: newBadges
        };
      } catch (error) {
        this.logger.error(`[AWARD POINTS FAILED] User: ${userId}, Action: ${actionCode}, Error: ${error.message}`);
        throw error; // Rollback
      }
    });
  }

  /**
   * Kiểm tra và trao huy hiệu tự động bên trong Transaction
   */
  private async checkAndAwardBadges(manager: any, userId: string, totalPoints: number, category: string) {
      // Tìm các badge mà user đủ điểm nhưng chưa có
      const eligibleBadges = await manager.createQueryBuilder(Badge, 'badge')
        .where('badge.points_criteria <= :totalPoints', { totalPoints })
        .andWhere('(badge.category = :category OR badge.category = \'general\')', { category })
        .andWhere((qb: any) => {
            const subQuery = qb.subQuery()
                .select('ub.badge_id')
                .from(UserBadge, 'ub')
                .where('ub.user_id = :userId')
                .getQuery();
            return 'badge.id NOT IN ' + subQuery;
        })
        .setParameter('userId', userId)
        .getMany();

      const newBadgeRecords = [];
      for (const badge of eligibleBadges) {
          const userBadge = manager.create(UserBadge, {
              user_id: userId,
              badge_id: badge.id
          });
          await manager.save(userBadge);
          newBadgeRecords.push(badge);
          this.logger.log(`[BADGE UNLOCKED] User ${userId} unlocked badge ${badge.name}`);
      }
      return newBadgeRecords;
  }

  /**
   * Lấy bảng xếp hạng (Leaderboard)
   */
  async getLeaderboard(limit: number = 10) {
    return this.userRepo.find({
      select: ['id', 'full_name', 'avatar_url', 'points', 'level'],
      order: { points: 'DESC' },
      take: limit,
    });
  }

  /**
   * Lấy trạng thái tiến độ của người dùng
   */
  async getUserProgress(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'points', 'level'],
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const nextLevelPoints = user.level * 500;
    const currentLevelPoints = (user.level - 1) * 500;
    const progressInLevel = user.points - currentLevelPoints;
    const levelMax = nextLevelPoints - currentLevelPoints;

    return {
      points: user.points,
      level: user.level,
      next_level_points: nextLevelPoints,
      progress_percent: Math.round((progressInLevel / levelMax) * 100),
      points_needed: nextLevelPoints - user.points,
    };
  }

  /**
   * Lấy danh sách huy hiệu của user
   */
  async getUserBadges(userId: string) {
    return this.userBadgeRepo.find({
        where: { user_id: userId },
        relations: ['badge'],
        order: { earned_at: 'DESC' }
    });
  }

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
        await this.awardPoints(
            activity.user_id, 
            50, 
            `GREEN_ACTIVITY_${activity.activity_type}`, 
            'green',
            activity.id
        );
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
