import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AIService } from '../ai/ai.service';
import { DEV_USER_UUID } from '../../common/constants/dev-user.constants';

@Injectable()
export class ScholarshipService {
  constructor(
    @InjectRepository(Scholarship) private scholarRepo: Repository<Scholarship>,
    @InjectRepository(ScholarshipApplication) private appRepo: Repository<ScholarshipApplication>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly notifyService: NotificationsService,
    private readonly aiService: AIService,
  ) { }

  async getAllScholarships(page: number = 1, limit: number = 10) {
    const [items, total] = await this.scholarRepo.findAndCount({
      where: { deleted_at: null },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' }
    });

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }
    };
  }

  /**
   * Lấy chi tiết một học bổng theo ID
   */
  async getScholarshipById(id: string) {
    const scholar = await this.scholarRepo.findOne({ where: { id } });
    if (!scholar) throw new NotFoundException('Học bổng không tồn tại');
    return scholar;
  }

  /**
   * Kiểm tra điều kiện nộp đơn (Eligibility Check) - AI Powered
   * Nhận thêm transcript_data (từ PDF bảng điểm) để tính điểm GPA
   */
  async checkEligibility(userId: string, scholarshipId: string, body?: any) {
    const scholar = await this.scholarRepo.findOne({ where: { id: scholarshipId } });
    if (!scholar) throw new NotFoundException('Học bổng không tồn tại');

    // Truyền dữ liệu bảng điểm PDF nếu có
    const transcriptData = body?.gpa || body?.overall_grade || body?.courses ? body : null;

    let user = await this.userRepo.findOne({
      where: { id: userId as any },
    });
    if (!user) {
      // On HF Spaces (free plan) the SQLite file reverts to the Docker image
      // on every restart. Users created at runtime via Google login are
      // lost, but their JWT remains valid (same JWT_SECRET) so the
      // JwtAuthGuard already passed. Instead of 404-ing, fall back to the
      // deterministic dev user so the feature still degrades gracefully.
      user = await this.userRepo.findOne({
        where: { id: DEV_USER_UUID },
      });
    }
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Gọi AI Service để phân tích thực tế
    const aiAnalysis = await this.aiService.checkScholarshipEligibility(user, scholar, transcriptData);

    return aiAnalysis;
  }

  /**
   * Nộp đơn ứng tuyển
   */
  async applyScholarship(userId: string, scholarshipId: string, personalStatement: string, cvUrl: string) {
    const scholar = await this.scholarRepo.findOne({ where: { id: scholarshipId } });
    if (!scholar) throw new NotFoundException('Học bổng không tồn tại');

    const existing = await this.appRepo.findOne({ 
      where: { student_id: userId, scholarship_id: scholarshipId } 
    });
    if (existing) throw new BadRequestException('Bạn đã nộp đơn cho học bổng này rồi');

    const application = this.appRepo.create({
      scholarship_id: scholarshipId,
      student_id: userId,
      personal_statement: personalStatement,
      cv_url: cvUrl,
      status: 'pending'
    });

    const saved = await this.appRepo.save(application);
// Gửi thông báo cho sinh viên
await this.notifyService.sendNotification(
  userId,
  `Nộp đơn thành công: Bạn đã nộp hồ sơ ứng tuyển học bổng: ${scholar.title}. Vui lòng theo dõi trạng thái tại Dashboard.`,
  'in-app'
);

    return saved;
  }

  /**
   * Lấy danh sách đơn nộp của một người dùng
   */
  async getUserApplications(userId: string) {
    return this.appRepo.find({
      where: { student_id: userId },
      relations: ['scholarship'],
      order: { created_at: 'DESC' }
    });
  }

  /**
   * Tạo học bổng mới - Tự động đồng bộ tri thức sang AI Vector Store
   */
  async createScholarship(data: Partial<Scholarship>) {
    const scholar = this.scholarRepo.create(data);
    const saved = await this.scholarRepo.save(scholar);
    // Tự động kích hoạt đồng bộ sang AI Vector Store chạy ngầm
    this.aiService.triggerKnowledgeSync();
    return saved;
  }

  /**
   * Cập nhật học bổng - Tự động đồng bộ tri thức sang AI Vector Store
   */
  async updateScholarship(id: string, data: Partial<Scholarship>) {
    const scholar = await this.scholarRepo.findOne({ where: { id } });
    if (!scholar) throw new NotFoundException('Học bổng không tồn tại');
    Object.assign(scholar, data);
    const saved = await this.scholarRepo.save(scholar);
    // Tự động kích hoạt đồng bộ sang AI Vector Store chạy ngầm
    this.aiService.triggerKnowledgeSync();
    return saved;
  }
}
