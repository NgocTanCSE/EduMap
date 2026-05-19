import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scholarship } from './entities/scholarship.entity';

@Injectable()
export class ScholarshipService {
  constructor(
    @InjectRepository(Scholarship) private scholarRepo: Repository<Scholarship>,
  ) {}

  /**
   * 1. Kiểm tra điều kiện nộp đơn (Eligibility Check)
   */
  async checkEligibility(userId: string, scholarshipId: string) {
    const scholar = await this.scholarRepo.findOne({ where: { id: scholarshipId } });
    if (!scholar) throw new BadRequestException('Học bổng không tồn tại');

    // Thuật toán: So sánh GPA, ngành học của User (từ bảng UserProfile) với yêu cầu của Scholarship
    // Giả lập kết quả
    const userGPA = 3.6;
    const requiredGPA = 3.2; // Giả sử lấy từ DB
    
    if (userGPA >= requiredGPA) {
      return { is_eligible: true, message: 'Bạn đủ điều kiện nộp học bổng này!' };
    }
    return { is_eligible: false, message: 'Bạn chưa đạt yêu cầu GPA tối thiểu (3.2).' };
  }

  /**
   * 2. Nộp đơn & Theo dõi tiến độ (Apply & Tracking)
   */
  async applyScholarship(userId: string, scholarshipId: string, cvUrl: string) {
    // Lưu vào bảng Application
    return { success: true, tracking_id: 'APP-' + Date.now(), status: 'submitted' };
  }
}
