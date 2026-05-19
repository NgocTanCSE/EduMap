import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';

@Injectable()
export class OpportunityService {
  constructor(
    @InjectRepository(Opportunity) private readonly oppRepo: Repository<Opportunity>,
  ) {}

  /**
   * F-16: Hiển thị cơ hội (Học bổng, Cuộc thi, Thực tập) trên bản đồ
   * Hỗ trợ tìm kiếm theo vùng không gian Mapbox Bounds (minLng, minLat, maxLng, maxLat)
   */
  async getOpportunities(type?: string, field?: string, bounds?: string) {
    const qb = this.oppRepo.createQueryBuilder('opp');

    if (type) {
      qb.andWhere('opp.category = :type', { type });
    }

    if (field) {
      qb.andWhere('opp.title ILIKE :field OR opp.description ILIKE :field', { field: `%${field}%` });
    }

    if (bounds) {
      const parts = bounds.split(',').map(Number);
      if (parts.length === 4 && parts.every(num => !isNaN(num))) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        qb.andWhere(
          `opp.location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)`,
          { minLng, minLat, maxLng, maxLat }
        );
      }
    }

    return qb.orderBy('opp.created_at', 'DESC').getMany();
  }

  /**
   * Tạo cơ hội học tập/thực tập mới
   */
  async createOpportunity(data: any) {
    let locationGeometry = null;
    if (data.latitude && data.longitude) {
      locationGeometry = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const opportunity = this.oppRepo.create({
      title: data.title,
      category: data.category,
      description: data.description,
      location: locationGeometry,
      address: data.address,
      deadline: data.deadline ? new Date(data.deadline) : null,
      is_team_finding_open: data.is_team_finding_open || false,
      tags: data.tags || [],
    });

    return this.oppRepo.save(opportunity);
  }

  /**
   * Lấy chi tiết cơ hội bằng ID
   */
  async findOne(id: string) {
    const opportunity = await this.oppRepo.findOne({ where: { id } });
    if (!opportunity) throw new NotFoundException('Không tìm thấy cơ hội được yêu cầu');
    return opportunity;
  }

  /**
   * Bật/Tắt tìm kiếm đồng đội tham gia cuộc thi
   */
  async toggleTeamFinding(id: string) {
    const opportunity = await this.findOne(id);
    opportunity.is_team_finding_open = !opportunity.is_team_finding_open;
    return this.oppRepo.save(opportunity);
  }
}
