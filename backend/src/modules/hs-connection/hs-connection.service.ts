import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UniversityCounseling } from './entities/hs.entity';

@Injectable()
export class HsConnectionService {
  constructor(
    @InjectRepository(UniversityCounseling) private readonly hsRepo: Repository<UniversityCounseling>,
  ) {}

  /**
   * Tạo hồ sơ thông tin tư vấn tuyển sinh đại học mới
   */
  async createCounselingInfo(data: any) {
    const counseling = this.hsRepo.create(data);
    return this.hsRepo.save(counseling);
  }

  /**
   * Lấy danh sách hồ sơ tuyển sinh đại học phục vụ tư vấn học sinh THPT
   */
  async getCounselingList() {
    return this.hsRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-29: Đăng ký Campus Tour ảo & Ghép cặp sinh viên đại học tư vấn đồng hành (Mentor Matching)
   */
  async registerCampusTour(studentId: string, universityName: string) {
    const tourId = `TOUR-${Math.floor(100 + Math.random() * 900)}`;

    const mentors = [
      'Sinh viên năm 3 - Khoa Công nghệ thông tin',
      'Sinh viên năm 4 - Khoa Kinh tế đối ngoại',
      'Thủ khoa tuyển sinh đầu vào - Viện Đào tạo Quốc tế',
      'Ủy viên BCH Hội Sinh viên - Ban Hỗ trợ Học tập',
    ];
    const assignedMentor = mentors[Math.floor(Math.random() * mentors.length)];

    return {
      success: true,
      message: `Đăng ký tham quan Virtual Campus Tour tại trường ${universityName} thành công. Chúng tôi đã ghép cặp người đồng hành cho bạn.`,
      tour_id: tourId,
      university: universityName,
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 08:30:00',
      assigned_mentor: assignedMentor,
      student_id: studentId,
    };
  }
}
