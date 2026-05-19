import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPoint } from './entities/map-point.entity';

@Injectable()
export class MapService {
  constructor(
    @InjectRepository(MapPoint) 
    private pointRepo: Repository<MapPoint>,
  ) {}

  /**
   * Lấy tất cả các điểm giáo dục đã phê duyệt
   */
  async getPoints() {
    return this.pointRepo.find({
      where: { status: 'approved' },
      order: { name: 'ASC' },
    });
  }

  /**
   * TÌM KIẾM THEO BÁN KÍNH (ST_DWithin)
   * Giúp tìm các địa điểm trong vòng X mét từ một tọa độ (lat, lng)
   */
  async findNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
    return this.pointRepo
      .createQueryBuilder('point')
      .where('point.status = :status', { status: 'approved' })
      .andWhere(
        'ST_DWithin(point.location, ST_SetSRID(ST_Point(:lng, :lat), 4326)::geography, :radius)',
        { lng, lat, radius: radiusInMeters }
      )
      .getMany();
  }

  /**
   * Tìm kiếm theo từ khóa và loại hình
   */
  async searchPoints(q: string, type?: string) {
    const qb = this.pointRepo.createQueryBuilder('point');
    qb.where('point.status = :status', { status: 'approved' });
    
    if (q) {
      qb.andWhere('(point.name ILIKE :q OR point.description ILIKE :q)', { q: `%${q}%` });
    }
    
    if (type) {
      const typeMap: { [key: string]: number[] } = {
        'school': [1, 2],
        'library': [3, 4],
        'lab': [5],
        'university': [1],
        'highschool': [2],
      };
      const mappedIds = typeMap[type.toLowerCase()];
      if (mappedIds && mappedIds.length > 0) {
        qb.andWhere('point.type_id IN (:...mappedIds)', { mappedIds });
      } else if (!isNaN(Number(type))) {
        qb.andWhere('point.type_id = :typeId', { typeId: Number(type) });
      }
    }

    return qb.getMany();
  }

  /**
   * Thêm điểm mới (Crowdsourcing)
   */
  async createPoint(data: any) {
    const point = this.pointRepo.create({
      ...data,
      location: {
        type: 'Point',
        coordinates: [Number(data.lng), Number(data.lat)],
      },
      status: data.status || 'pending', // Crowdsourced points default to pending
    });
    return this.pointRepo.save(point);
  }

  /**
   * Phê duyệt/từ chối điểm bản đồ crowdsource
   */
  async approvePoint(id: string, status: 'approved' | 'rejected') {
    const point = await this.pointRepo.findOne({ where: { id } });
    if (!point) {
      throw new NotFoundException(`Educational point with ID ${id} not found`);
    }
    point.status = status;
    return this.pointRepo.save(point);
  }

  /**
   * Lấy dữ liệu Heatmap (GeoJSON)
   */
  async getHeatmapData() {
    const points = await this.pointRepo.find({ where: { status: 'approved' } });
    return points
      .filter(p => p.location && p.location.coordinates)
      .map(p => ({
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        weight: Number(p.rating_avg) > 0 ? Number(p.rating_avg) / 5 : 1.0,
      }));
  }
}
