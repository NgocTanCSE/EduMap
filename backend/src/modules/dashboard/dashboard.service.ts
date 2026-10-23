import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserEvent } from '../analytics/entities/user-event.entity';
import { UserLearningHistory } from '../library/entities/user-learning-history.entity';
import { UserCareer } from '../career/entities/user-career.entity';
import { UserSkill } from '../career/entities/user-skill.entity';
import { Post, Comment } from '../community/entities/community.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { UserCertificate } from '../certificate/entities/user-certificate.entity';
import { AIService } from '../ai/ai.service';
import { MapService } from '../map/map.service';
import { EducationStat } from '../analytics/entities/education-stat.entity';

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
    @InjectRepository(EducationStat) private readonly educationStatRepo: Repository<EducationStat>,
    private readonly aiService: AIService,
    private readonly mapService: MapService,
    private readonly dataSource: DataSource,
  ) {}

  async getUserDashboard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await Promise.allSettled([
      this.userRepository.findOne({ where: { id: userId as any }, select: ['id', 'full_name', 'email', 'avatar_url', 'role'] }),
      this.historyRepo.count({ where: { user: { id: userId } as any } }),
      this.skillRepo.count({ where: { user_id: userId } }),
      this.careerRepo.find({ where: { user_id: userId, status: 'active' as any }, take: 3 }),
      this.postRepo.count({ where: { author_id: userId } }),
      this.commentRepo.count({ where: { author_id: userId } }),
      this.bookingRepo.find({ 
        where: { student_id: userId, status: 'confirmed', slot_start: MoreThanOrEqual(today) },
        relations: ['mentor', 'mentor.user'],
        order: { slot_start: 'ASC' },
        take: 3
      }),
      this.certRepo.count({ where: { user_id: userId, status: 'active' as any } })
    ]);

    const getValue = (result: PromiseSettledResult<any>, fallback: any) => result.status === 'fulfilled' ? result.value : fallback;

    return {
      user: getValue(results[0], null),
      stats: {
        learning_materials: getValue(results[1], 0),
        skills_mastered: getValue(results[2], 0),
        community_contributions: getValue(results[4], 0) + getValue(results[5], 0),
        certificates_earned: getValue(results[7], 0)
      },
      active_goals: getValue(results[3], []),
      upcoming_mentoring: getValue(results[6], []).map((b: any) => ({
          id: b.id,
          mentor_name: b.mentor?.user?.full_name || 'N/A',
          start: b.slot_start,
          meeting_url: b.meeting_url
      }))
    };
  }

  async getDailyInsight(userId: string) {
      const dashboardData = await this.getUserDashboard(userId);
      try {
        return await this.aiService.getDailyInsight(dashboardData);
      } catch (error: any) {
        // AI service unavailable (503) — return a local fallback so the dashboard
        // never breaks when the AI service is down.
        this.logger.warn(`AI Daily Insight unavailable, using local fallback: ${error.message}`);
        return {
          motivation_message: 'Hãy tiếp tục học tập và theo dõi tiến độ của bạn trên EduMap.',
          suggested_action: 'Xem lại các khóa học đã lưu hoặc khám phá sự kiện sắp tới.',
        };
      }
  }

  /**
   * Lịch sử đăng ký / ứng tuyển của user — gộp applications, event_registrations,
   * internship_applications, scholarship_applications, summer_registrations.
   * `$1` placeholder (sqlite3 + Postgres đều hỗ trợ); JOIN title nếu bảng tồn tại.
   * Bọc try/catch để một join lỗi (ví dụ bảng tên khác) không bánk cả endpoint.
   */
  async getUserHistory(
    userId: string,
  ): Promise<Array<{ type: string; title: string | null; status: string; created_at: Date }>> {
    const sql = `
      SELECT * FROM (
        SELECT 'application' AS type, j.title AS title, a.status, a.created_at
          FROM applications a JOIN jobs j ON CAST(j.id AS TEXT) = CAST(a.job_id AS TEXT)
          WHERE a.user_id = $1
        UNION ALL
        SELECT 'registration' AS type, e.title, er.status, er.created_at
          FROM event_registrations er JOIN events e ON CAST(e.id AS TEXT) = CAST(er.event_id AS TEXT)
          WHERE er.user_id = $1
        UNION ALL
        SELECT 'intern_application' AS type, i.title, ia.status, ia.created_at
          FROM internship_applications ia JOIN internships i ON CAST(i.id AS TEXT) = CAST(ia.internship_id AS TEXT)
          WHERE ia.user_id = $1
        UNION ALL
        SELECT 'scholar_application' AS type, s.title, sa.status, sa.created_at
          FROM scholarship_applications sa JOIN scholarships s ON CAST(s.id AS TEXT) = CAST(sa.scholarship_id AS TEXT)
          WHERE sa.student_id = $1
        UNION ALL
        SELECT 'summer_registration' AS type, CAST(cr.campaign_id AS TEXT) AS title, cr.status, cr.created_at
          FROM summer_registrations cr WHERE cr.user_id = $1
      ) t ORDER BY created_at DESC
    `;
    try {
      return await this.dataSource.query(sql, [userId]);
    } catch (e) {
      this.logger.error('getUserHistory failed', e);
      return [];
    }
  }

  /**
   * Bảng điều khiển Quản trị viên: Phân tích dữ liệu chuyên sâu
   */
  async getStats() {
    const [userCount, eventCount, educationStats, roleDist, trendData] = await Promise.all([
      this.userRepository.count(),
      this.userEventRepository.count(),
      this.educationStatRepo.find({ take: 10 }), // Get recent education stats
      
      // 1. Phân bổ vai trò người dùng (alias 'u' tránh reserved keyword 'user' trong PostgreSQL)
      this.userRepository.createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('u.role')
        .getRawMany(),

      // 2. Xu hướng đăng ký người dùng mới (6 tháng gần nhất)
      this.userRepository.createQueryBuilder('u')
        .select("TO_CHAR(u.created_at, 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'count')
        .groupBy('month')
        .orderBy('month', 'DESC')
        .limit(6)
        .getRawMany()
    ]);

    // 3. Top 5 sự kiện phổ biến
    const topEvents = await this.userEventRepository
      .createQueryBuilder('event')
      .select('event.event_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.event_type')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // 4. Dữ liệu bản đồ nhiệt thực tế
    let heatmapData = [];
    try {
      const pois = await this.mapService.findAllPois();
      heatmapData = pois.map(poi => ({
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category,
        intensity: 0.8
      }));
    } catch (e) {
      this.logger.error('Map analysis failed', e);
    }
    
    // 5. Tính education metrics từ dữ liệu thực tế
    const enrollmentRate = educationStats.find((s: any) => s.metricType === 'enrollment_rate');
    const adoptionScore = educationStats.find((s: any) => s.metricType === 'adoption_score');
    
    return {
      overview: {
        total_users: userCount,
        total_events: eventCount,
      },
      charts: {
        user_roles: roleDist,
        growth_trend: trendData.reverse(),
        top_activities: topEvents,
      },
      heatmap: heatmapData,
      education_metrics: {
        enrollment_rate: enrollmentRate ? `${enrollmentRate.metricValue}%` : '0%',
        adoption_score: adoptionScore ? `${adoptionScore.metricValue}/10` : '0/10',
      }
    };
  }
}
