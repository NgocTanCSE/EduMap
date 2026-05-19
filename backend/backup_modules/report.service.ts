import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EducationalPoint } from '../map/entities/educational-point.entity';
import { AnalyticsLog } from './entities/analytics-log.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(EducationalPoint) private mapRepo: Repository<EducationalPoint>,
    @InjectRepository(AnalyticsLog) private logRepo: Repository<AnalyticsLog>,
  ) {}

  /**
   * 🗺️ HEATMAP: Lay mat do hoat dong theo toa do dia ly
   */
  async getGeographicActivity() {
    // Query PostGIS de lay mat do cac diem dao tao va luot tuong tac
    return this.mapRepo.query(
      SELECT 
        name, 
        ST_X(location::geometry) as lng, 
        ST_Y(location::geometry) as lat,
        (SELECT COUNT(*) FROM analytics_logs WHERE metadata->>'point_id' = educational_points.id::text) as activity_count
      FROM educational_points
      ORDER BY activity_count DESC
    );
  }

  /**
   * 📊 EFFICIENCY: Báo cáo hiệu quả học tập toàn hệ thống
   */
  async getSystemEfficiency() {
    return {
      total_active_users: await this.logRepo.createQueryBuilder().select('DISTINCT(user_id)').getCount(),
      popular_category: await this.analyticsService.getTopKeywords(), // Reuse logic
      completion_rate: '68%', // Mock logic based on courses
    };
  }
}
