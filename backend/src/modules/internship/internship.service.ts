import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Internship } from './entities/internship.entity';

@Injectable()
export class InternshipService {
  constructor(
    @InjectRepository(Internship) private readonly internRepo: Repository<Internship>,
  ) {}

  /**
   * Tạo cơ hội thực tập mới (MOD-19)
   */
  async createInternship(companyId: string, data: any) {
    let location = null;
    if (data.latitude && data.longitude) {
      location = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const internship = this.internRepo.create({
      ...data,
      company_id: companyId,
      location,
      status: 'open',
    });
    return this.internRepo.save(internship);
  }

  /**
   * Lấy danh sách tất cả cơ hội thực tập
   */
  async getInternships() {
    return this.internRepo.find({
      relations: ['company'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Tìm kiếm cơ hội thực tập gần đây dựa trên khoảng cách địa lý (PostGIS GIS Spatial)
   */
  async getInternshipsNearby(lat: number, lng: number, radiusInMeters: number = 10000) {
    return this.internRepo.createQueryBuilder('internship')
      .leftJoinAndSelect('internship.company', 'company')
      .where(
        'ST_DWithin(internship.location, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lat, lng, radius: radiusInMeters }
      )
      .orderBy('internship.created_at', 'DESC')
      .getMany();
  }

  /**
   * Nộp đơn ứng tuyển thực tập (Apply CV)
   */
  async applyInternship(userId: string, internshipId: string, coverLetter: string) {
    const internship = await this.internRepo.findOne({ where: { id: internshipId } });
    if (!internship) throw new NotFoundException('Không tìm thấy cơ hội thực tập này');

    return {
      success: true,
      tracking_id: `INT-APPLY-${internshipId.substring(0, 8).toUpperCase()}-${userId.substring(0, 8).toUpperCase()}-${Date.now()}`,
      status: 'reviewing',
      message: 'Nộp hồ sơ ứng tuyển thục tập thành công! Nhà tuyển dụng sẽ xem xét hồ sơ của bạn.',
    };
  }
}
