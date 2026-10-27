import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge, UserBadge, UserPoint } from './entities/gamification.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { User } from '../auth/entities/user.entity';

export interface UserProgress {
  userId: string;
  points: number;
  achievements: string[];
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(UserPoint) private readonly userPointRepo: Repository<UserPoint>,
    @InjectRepository(GreenActivity) private readonly greenActivityRepo: Repository<GreenActivity>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async getUserProgress(userId: string): Promise<UserProgress> {
    try {
      const [pointSum, badges] = await Promise.all([
        this.userPointRepo.createQueryBuilder('up').select('SUM(up.points)', 'total').where('up.user_id = :userId', { userId }).getRawOne(),
        this.userBadgeRepo.find({ where: { user_id: userId }, relations: ['badge'] })
      ]);
      return {
        userId,
        points: parseInt(pointSum?.total || '0', 10),
        achievements: badges.map(ub => ub.badge.name)
      };
    } catch (error: any) {
      this.logger.error(`Error fetching user progress: ${error.message}`);
      return { userId, points: 0, achievements: [] };
    }
  }

  /**
   * Lấy danh sách huy hiệu (badge) của người dùng.
   * Ánh xạ theo bảng 6.2 — STT 25: gamification.service.ts ↳ getUserBadges()
   */
  async getUserBadges(userId: string): Promise<any[]> {
    try {
      const userBadges = await this.userBadgeRepo.find({
        where: { user_id: userId },
        relations: ['badge'],
      });
      return userBadges.map(ub => ({
        id: ub.id,
        badge_id: ub.badge_id,
        name: ub.badge?.name,
        category: ub.badge?.category,
        rarity: ub.badge?.rarity,
        earned_at: ub.earned_at,
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching user badges: ${error.message}`);
      return [];
    }
  }

  async getLeaderboard() {
    try {
      const users = await this.userPointRepo
        .createQueryBuilder('up')
        .select('up.user_id', 'id')
        .addSelect('SUM(up.points)', 'points')
        .leftJoin(User, 'user', 'user.id = up.user_id')
        .addSelect('user.full_name', 'full_name')
        .addSelect('user.avatar_url', 'avatar_url')
        .groupBy('up.user_id')
        .addGroupBy('user.full_name')
        .addGroupBy('user.avatar_url')
        .orderBy('points', 'DESC')
        .limit(10)
        .getRawMany();

      return users.map(user => ({
        id: user.id,
        full_name: user.full_name || 'Người dùng',
        avatar_url: user.avatar_url || '',
        points: parseInt(user.points || '0', 10),
        level: Math.floor(parseInt(user.points || '0', 10) / 100) + 1,
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching leaderboard: ${error.message}`);
      return [];
    }
  }

  /**
   * Lấy hạng (rank) của một người dùng dựa trên tổng số points so với
   * tất cả người dùng khác. Trả về { rank, total, points } để frontend
   * có thể hiển thị "Bạn đang hạng #N / Tổng M người chơi".
   *
   * Nếu người dùng chưa có bất kỳ user_points nào (points = 0), hạng sẽ
   * được tính dựa trên số người có points > 0.
   */
  async getUserRank(userId: string): Promise<{ rank: number; total: number; points: number }> {
    try {
      const pointSum = await this.userPointRepo
        .createQueryBuilder('up')
        .select('SUM(up.points)', 'total')
        .where('up.user_id = :userId', { userId })
        .getRawOne();

      const userPoints = parseInt(pointSum?.total || '0', 10);

      // Count users who have strictly more points → rank = count + 1
      const higherCount = await this.userPointRepo
        .createQueryBuilder('up')
        .select('up.user_id')
        .groupBy('up.user_id')
        .having('SUM(up.points) > :userPoints', { userPoints })
        .getCount();

      // Total users with at least 1 point entry
      const total = await this.userPointRepo
        .createQueryBuilder('up')
        .select('up.user_id')
        .groupBy('up.user_id')
        .getCount();

      return {
        rank: higherCount + 1,
        total,
        points: userPoints,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching user rank: ${error.message}`);
      return { rank: 0, total: 0, points: 0 };
    }
  }

  async awardPoints(userId: string, points: number, action: string = 'system_award', referenceId?: string): Promise<UserProgress> {
    try {
      if (points !== 0) {
        const pointEntry = this.userPointRepo.create({ user_id: userId, points, action, reference_id: referenceId });
        await this.userPointRepo.save(pointEntry);
      }
      return this.getUserProgress(userId);
    } catch (error: any) {
      this.logger.error(`Error awarding points: ${error.message}`);
      return this.getUserProgress(userId);
    }
  }

  async grantAchievement(userId: string, achievementName: string): Promise<UserProgress> {
    try {
      let badge = await this.badgeRepo.findOne({ where: { name: achievementName } });
      if (!badge) {
        badge = this.badgeRepo.create({ name: achievementName, category: 'general', points_criteria: 0 });
        await this.badgeRepo.save(badge);
      }
      
      const existing = await this.userBadgeRepo.findOne({ where: { user_id: userId, badge_id: badge.id } });
      if (!existing) {
        const userBadge = this.userBadgeRepo.create({ user_id: userId, badge_id: badge.id });
        await this.userBadgeRepo.save(userBadge);
      }
      return this.getUserProgress(userId);
    } catch (error: any) {
      this.logger.error(`Error granting achievement: ${error.message}`);
      return this.getUserProgress(userId);
    }
  }

  async submitGreenActivity(userId: string, activityType: string, description: string, proofUrl: string) {
    const activity = this.greenActivityRepo.create({
      user_id: userId,
      activity_type: activityType,
      description,
      proof_url: proofUrl,
      status: 'pending',
      ai_confidence: 0,
    });
    const saved = await this.greenActivityRepo.save(activity);
    return this.awardPoints(userId, 50, `GREEN_${activityType}`, saved.id);
  }
}
