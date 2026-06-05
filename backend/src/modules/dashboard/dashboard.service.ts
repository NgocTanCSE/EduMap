import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserEvent } from '../analytics/entities/user-event.entity';
import { UserLearningHistory } from '../library/entities/user-learning-history.entity';
import { UserCareer } from '../career/entities/user-career.entity';
import { UserSkill } from '../career/entities/user-skill.entity';
import { Post, Comment } from '../community/entities/community.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { UserCertificate } from '../certificate/entities/user-certificate.entity';
import { AIService } from '../ai/ai.service'; // Import AIService
import { MapService } from '../map/map.service'; // Import MapService

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserEvent) private readonly userEventRepository: Repository<UserEvent>,
    @InjectRepository(UserLearningHistory) private readonly historyRepo: Repository<UserLearningHistory>,
    @InjectRepository(UserCareer) private readonly careerRepo: Repository<UserCareer>,
    @InjectRepository(UserSkill) private readonly skillRepo: Repository<UserSkill>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(UserCertificate) private readonly certRepo: Repository<UserCertificate>,
    private readonly aiService: AIService, // Inject AIService
    private readonly mapService: MapService, // Inject MapService
  ) {}

  /**
   * Lấy dữ liệu tổng quan cá nhân hóa cho người dùng (Dashboard)
   */
  async getUserDashboard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sử dụng Promise.allSettled để tránh Partial Failure (Edge Case 2)
    const results = await Promise.allSettled([
      // 0. Thông tin user cơ bản
      this.userRepository.findOne({ where: { id: userId as any }, select: ['id', 'full_name', 'email', 'avatar_url', 'role'] }),
      // 1. Tiến độ học tập
      this.historyRepo.count({ where: { user: { id: userId } as any } }),
      // 2. Kỹ năng & Nguyện vọng
      this.skillRepo.count({ where: { user_id: userId } }),
      this.careerRepo.find({ where: { user_id: userId, status: 'active' as any }, take: 3 }),
      // 3. Hoạt động cộng đồng
      this.postRepo.count({ where: { author_id: userId } }),
      this.commentRepo.count({ where: { author_id: userId } }),
      // 4. Lịch hẹn Mentor sắp tới (từ hôm nay trở đi)
      this.bookingRepo.find({ 
        where: { student_id: userId, status: 'confirmed', slot_start: MoreThanOrEqual(today) },
        relations: ['mentor', 'mentor.user'],
        order: { slot_start: 'ASC' },
        take: 3
      }),
      // 5. Chứng chỉ
      this.certRepo.count({ where: { user_id: userId, status: 'active' as any } })
    ]);

    // Xử lý kết quả trả về an toàn
    const getValue = (result: PromiseSettledResult<any>, fallback: any) => 
      result.status === 'fulfilled' ? result.value : fallback;

    const user = getValue(results[0], null);
    const learningCount = getValue(results[1], 0);
    const skillsCount = getValue(results[2], 0);
    const activeCareers = getValue(results[3], []);
    const postCount = getValue(results[4], 0);
    const commentCount = getValue(results[5], 0);
    const upcomingBookings = getValue(results[6], []);
    const certCount = getValue(results[7], 0);

    return {
      user,
      stats: {
        learning_materials: learningCount,
        skills_mastered: skillsCount,
        community_contributions: postCount + commentCount,
        certificates_earned: certCount
      },
      active_goals: activeCareers,
      upcoming_mentoring: upcomingBookings.map(b => ({
          id: b.id,
          mentor_name: b.mentor?.user?.full_name || 'N/A',
          start: b.slot_start,
          meeting_url: b.meeting_url
      }))
    };
  }

  /**
   * AI Insight: Lấy lời khuyên mỗi ngày
   */
  async getDailyInsight(userId: string) {
      const dashboardData = await this.getUserDashboard(userId);
      return this.aiService.getDailyInsight(dashboardData);
  }

  /**
   * F-08: Dashboard phân tích dữ liệu (Dành cho Admin/Global)
   */
  async getStats() {
    const userCount = await this.userRepository.count();
    const eventCount = await this.userEventRepository.count();

    // Lấy top 5 sự kiện phổ biến
    const topEvents = await this.userEventRepository
      .createQueryBuilder('event')
      .select('event.event_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.event_type')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Replace mock heatmap data with data from MapService
    let realHeatmapData: any[] = [];
    try {
      const pois = await this.mapService.findAllPois();
      realHeatmapData = pois.map(poi => ({
        id: poi.id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        intensity: 0.7 + Math.random() * 0.3, // Example: add some random intensity for visualization
      }));
    } catch (error) {
      this.logger.error(`Failed to retrieve POIs for heatmap: ${error.message}`);
      // Defensive: Fallback to empty array if MapService fails
      realHeatmapData = [];
    }
    
    return {
      total_users: userCount,
      total_events: eventCount,
      top_activities: topEvents,
      heatmap_data: realHeatmapData, // Use realHeatmapData
      education_metrics: {
        enrollment_rate: '96.4%',
        student_teacher_ratio: '18.5',
        online_learning_adoption: '78.2%',
      },
    };
  }
}
