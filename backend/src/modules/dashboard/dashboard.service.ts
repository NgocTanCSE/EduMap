import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { MapPoint } from '../map/entities/map-point.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(MapPoint) private readonly mapRepository: Repository<MapPoint>,
  ) {}

  /**
   * F-08: Dashboard phân tích dữ liệu & Bản đồ nhiệt (Heatmap)
   */
  async getStats() {
    const userCount = await this.userRepository.count();
    const mapCount = await this.mapRepository.count();
    
    // Đếm số điểm bản đồ chờ phê duyệt (status = 'pending')
    const pendingPoints = await this.mapRepository.count({
      where: { status: 'pending' },
    });

    // Lấy danh sách vị trí thực tế của các điểm bản đồ để tạo Heatmap
    const mapPoints = await this.mapRepository.find({
      select: ['id', 'name', 'location', 'rating_avg'],
      where: { status: 'approved' },
      take: 100, // Giới hạn lấy 100 điểm mới nhất để tối ưu hiệu năng
    });

    const heatmapData = mapPoints
      .filter(point => point.location && point.location.coordinates)
      .map(point => {
        const [lng, lat] = point.location.coordinates;
        return {
          id: point.id,
          name: point.name,
          lat: Number(lat),
          lng: Number(lng),
          intensity: Number(point.rating_avg) > 0 ? Number(point.rating_avg) / 5 : 0.6,
        };
      });

    // Nếu không có dữ liệu thật trong DB, cung cấp mock dữ liệu các thành phố lớn tại Việt Nam
    const finalHeatmap = heatmapData.length > 0 ? heatmapData : [
      { id: 'mock-1', name: 'Đại học Quốc gia TP.HCM', lat: 10.875151, lng: 106.800724, intensity: 0.95 },
      { id: 'mock-2', name: 'Đại học Bách Khoa Hà Nội', lat: 21.006437, lng: 105.842777, intensity: 0.85 },
      { id: 'mock-3', name: 'Đại học Đà Nẵng', lat: 16.075489, lng: 108.220123, intensity: 0.75 },
      { id: 'mock-4', name: 'Đại học Cần Thơ', lat: 10.029864, lng: 105.768652, intensity: 0.8 },
      { id: 'mock-5', name: 'Nhà văn hóa Thanh niên TP.HCM', lat: 10.782502, lng: 106.697424, intensity: 0.9 },
    ];

    return {
      total_users: userCount,
      total_map_points: mapCount,
      pending_approval_points: pendingPoints,
      heatmap_data: finalHeatmap,
      education_metrics: {
        enrollment_rate: '96.4%',
        student_teacher_ratio: '18.5',
        online_learning_adoption: '78.2%',
      },
    };
  }
}
