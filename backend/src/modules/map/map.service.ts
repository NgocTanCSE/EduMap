import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { LocationCategory } from './entities/location-category.entity';
import { AIService } from '../ai/ai.service';

@Injectable()
export class MapService {
  constructor(
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(LocationCategory) private readonly categoryRepo: Repository<LocationCategory>,
    private readonly aiService: AIService,
  ) {}

  /**
   * Lấy tất cả các địa điểm đã xác minh
   */
  async getLocations(categoryId?: number) {
    const whereClause: any = { status: 'active' };
    if (categoryId) whereClause.category_id = categoryId;

    return this.locationRepo.find({
      where: whereClause,
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  /**
   * TÌM KIẾM THEO BÁN KÍNH (ST_DWithin)
   * Giúp tìm các địa điểm trong vòng X mét từ một tọa độ (lat, lng)
   */
  async findNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
    return this.locationRepo
      .createQueryBuilder('loc')
      .leftJoinAndSelect('loc.category', 'category')
      .where('loc.status = :status', { status: 'active' })
      .andWhere(
        'ST_DWithin(loc.coordinates, ST_SetSRID(ST_Point(:lng, :lat), 4326)::geography, :radius)',
        { lng, lat, radius: radiusInMeters }
      )
      .getMany();
  }

  /**
   * TÌM KIẾM TRONG VÙNG NHÌN (ST_MakeEnvelope)
   * Tìm các địa điểm nằm trong hình chữ nhật bao quanh (viewport)
   */
  async findInBounds(swLat: number, swLng: number, neLat: number, neLng: number) {
    return this.locationRepo
      .createQueryBuilder('loc')
      .leftJoinAndSelect('loc.category', 'category')
      .where('loc.status = :status', { status: 'active' })
      .andWhere(
        'loc.coordinates && ST_MakeEnvelope(:swLng, :swLat, :neLng, :neLat, 4326)',
        { swLng, swLat, neLng, neLat }
      )
      .getMany();
  }

  /**
   * Tìm kiếm theo từ khóa
   */
  async searchLocations(q: string) {
    return this.locationRepo
      .createQueryBuilder('loc')
      .leftJoinAndSelect('loc.category', 'category')
      .where('loc.status = :status', { status: 'active' })
      .andWhere('(loc.name ILIKE :q OR loc.description ILIKE :q OR loc.address ILIKE :q)', { q: `%${q}%` })
      .getMany();
  }

  /**
   * Lấy chi tiết một địa điểm
   */
  async getLocationById(id: string) {
    const location = await this.locationRepo.findOne({
      where: { id },
      relations: ['category', 'creator'],
    });
    if (!location) throw new NotFoundException('Địa điểm không tồn tại');
    return location;
  }

  /**
   * Tạo địa điểm mới
   */
  async createLocation(data: any, userId?: string) {
    const location = this.locationRepo.create({
      ...data,
      coordinates: {
        type: 'Point',
        coordinates: [Number(data.lng), Number(data.lat)],
      },
      created_by: userId,
    });
    return this.locationRepo.save(location);
  }

  /**
   * Cập nhật địa điểm
   */
  async updateLocation(id: string, data: any) {
    const location = await this.getLocationById(id);
    
    if (data.lat && data.lng) {
      data.coordinates = {
        type: 'Point',
        coordinates: [Number(data.lng), Number(data.lat)],
      };
      delete data.lat;
      delete data.lng;
    }

    Object.assign(location, data);
    return this.locationRepo.save(location);
  }

  /**
   * Xóa địa điểm
   */
  async deleteLocation(id: string) {
    const location = await this.getLocationById(id);
    return this.locationRepo.remove(location);
  }

  /**
   * Lấy danh mục địa điểm
   */
  async getCategories() {
    return this.categoryRepo.find({ order: { display_name: 'ASC' } });
  }

  /**
   * 🤖 AI GEO-ANALYSIS
   * Sử dụng AI để phân tích mật độ giáo dục và gợi ý khu vực cần đầu tư
   */
  async analyzeEducationDensity(city: string) {
    const locations = await this.locationRepo.find({
        where: { city: city, status: 'active' },
        relations: ['category']
    });

    const geoData = locations.map(l => ({
        name: l.name,
        type: l.category.name,
        lat: l.coordinates.coordinates[1],
        lng: l.coordinates.coordinates[0]
    }));

    // Gửi dữ liệu sang AI Service
    return this.aiService.analyzeGeoDensity({
        city,
        points: geoData
    });
  }
}
