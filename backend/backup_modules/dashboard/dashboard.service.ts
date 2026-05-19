import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity'; // FIXED: Tr? v? auth thay v? users
import { MapPoint } from '../map/entities/map-point.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(MapPoint) private mapRepository: Repository<MapPoint>,
  ) {}

  async getStats() {
    const userCount = await this.userRepository.count();
    const mapCount = await this.mapRepository.count();
    return {
      total_users: userCount,
      total_map_points: mapCount,
      heatmap_data: [
        { lat: 10.762622, lng: 106.660172, intensity: 0.8 }
      ]
    };
  }
}
