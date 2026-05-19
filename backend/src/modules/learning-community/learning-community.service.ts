import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSpot } from './entities/learning-spot.entity';

@Injectable()
export class LearningCommunityService {
  constructor(
    @InjectRepository(LearningSpot) private readonly spotRepo: Repository<LearningSpot>,
  ) {}

  /**
   * Tạo địa điểm tự học mới (Tích hợp GIS)
   */
  async createSpot(data: any) {
    if (!data.name || !data.latitude || !data.longitude) {
      throw new BadRequestException('Vui lòng cung cấp đầy đủ tên, kinh độ và vĩ độ của địa điểm');
    }

    const point = {
      type: 'Point',
      coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)],
    };

    const spot = this.spotRepo.create({
      name: data.name,
      location: point,
      type: data.type || 'study_space',
      has_wifi: data.has_wifi !== undefined ? data.has_wifi : true,
      has_power_outlets: data.has_power_outlets !== undefined ? data.has_power_outlets : true,
      total_capacity: data.total_capacity || 50,
      rating_avg: data.rating_avg || 5.0,
    });

    return this.spotRepo.save(spot);
  }

  /**
   * Truy vấn địa điểm học tập lân cận (Sử dụng PostGIS ST_DWithin tối ưu)
   */
  async getNearbySpots(latitude: number, longitude: number, radiusInMeters: number = 5000) {
    return this.spotRepo
      .createQueryBuilder('spot')
      .where(
        'ST_DWithin(spot.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :radius)',
        { longitude, latitude, radius: radiusInMeters },
      )
      .getMany();
  }

  /**
   * Kiểm tra tình trạng chỗ trống thời gian thực (Real-time occupancy simulation)
   */
  async checkAvailability(spotId: string) {
    const spot = await this.spotRepo.findOne({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException('Địa điểm học tập không tồn tại');
    }

    // Giả lập số lượng người đang học dựa trên thời gian hiện tại
    const currentHour = new Date().getHours();
    let occupancyRate = 0.3; // 30% mặc định

    if (currentHour >= 8 && currentHour <= 11) {
      occupancyRate = 0.75; // Cao điểm sáng
    } else if (currentHour >= 14 && currentHour <= 17) {
      occupancyRate = 0.85; // Cao điểm chiều
    } else if (currentHour >= 19 && currentHour <= 22) {
      occupancyRate = 0.95; // Cao điểm tối
    } else if (currentHour >= 23 || currentHour <= 6) {
      occupancyRate = 0.05; // Đêm muộn
    }

    const currentOccupancy = Math.floor(spot.total_capacity * occupancyRate);
    const availableSeats = Math.max(0, spot.total_capacity - currentOccupancy);

    let status = 'available';
    if (availableSeats === 0) {
      status = 'full';
    } else if (availableSeats <= 5) {
      status = 'almost_full';
    }

    return {
      spot_id: spot.id,
      spot_name: spot.name,
      total_capacity: spot.total_capacity,
      current_occupancy: currentOccupancy,
      available_seats: availableSeats,
      status,
      last_updated: new Date(),
    };
  }
}
