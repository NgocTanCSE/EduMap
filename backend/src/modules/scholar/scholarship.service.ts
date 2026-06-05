import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class ScholarshipService {
  constructor(
    @InjectRepository(Scholarship) private scholarRepo: Repository<Scholarship>,
    @InjectRepository(ScholarshipApplication) private appRepo: Repository<ScholarshipApplication>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly notifyService: NotificationsService,
    private readonly aiService: AIService,
  ) { }

  async getAllScholarships() {
    return this.scholarRepo.find({ where: { deleted_at: null } });
  }

  /**
   * Kiểm tra điều kiện nộp đơn (Eligibility Check) - AI Powered
   */
  async checkEligibility(userId: string, scholarshipId: string) {
    const scholar = await this.scholarRepo.findOne({ where: { id: scholarshipId } });
    if (!scholar) throw new NotFoundException('Học bổng không tồn tại');

    const user = await this.userRepo.findOne({ 
      where: { id: userId as any },
      relations: ['profile'] // Assuming user has a profile relation
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Gọi AI Service để phân tích thực tế
    const aiAnalysis = await this.aiService.checkScholarshipEligibility(user, scholar);
    
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
}
