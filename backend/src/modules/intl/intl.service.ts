import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternationalProgram, AlumniNetwork } from './entities/intl.entity';

@Injectable()
export class IntlService {
  constructor(
    @InjectRepository(InternationalProgram)
    private readonly intlRepository: Repository<InternationalProgram>,
    @InjectRepository(AlumniNetwork)
    private readonly alumniRepository: Repository<AlumniNetwork>,
  ) {}

  /**
   * Lấy danh sách chương trình trao đổi quốc tế
   */
  async findAll(type?: string) {
    const where = type ? { type } : {};
    return this.intlRepository.find({ where, order: { created_at: 'DESC' } });
  }

  /**
   * Tạo mới chương trình trao đổi
   */
  async createProgram(data: any) {
    const program = this.intlRepository.create(data);
    return this.intlRepository.save(program);
  }

  /**
   * Đăng ký mạng lưới cựu lưu học sinh
   */
  async registerAlumni(data: any) {
    if (!data.full_name || !data.latitude || !data.longitude || !data.university) {
      throw new BadRequestException('Vui lòng điền đầy đủ họ tên, trường đại học, kinh độ và vĩ độ');
    }

    const point = {
      type: 'Point',
      coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)],
    };

    const alumni = this.alumniRepository.create({
      full_name: data.full_name,
      university: data.university,
      country: data.country || 'Global',
      major: data.major || 'General',
      location: point,
      contact_email: data.contact_email,
      status: data.status || 'studying',
    });

    return this.alumniRepository.save(alumni);
  }

  /**
   * Lấy danh sách lưu học sinh
   */
  async getAllAlumni() {
    return this.alumniRepository.find({ order: { created_at: 'DESC' } });
  }

  /**
   * Tìm kiếm lưu học sinh lân cận bằng PostGIS ST_DWithin
   */
  async getAlumniNearby(latitude: number, longitude: number, radiusInMeters: number = 50000) {
    return this.alumniRepository
      .createQueryBuilder('alumni')
      .where(
        'ST_DWithin(alumni.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :radius)',
        { longitude, latitude, radius: radiusInMeters },
      )
      .getMany();
  }
}
