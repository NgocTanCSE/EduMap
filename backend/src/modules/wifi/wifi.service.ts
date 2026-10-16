import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../map/entities/location.entity';

@Injectable()
export class WifiService {
  private readonly logger = new Logger(WifiService.name);

  constructor(
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
  ) {}

  async reportWifi(reporterId: string, data: any) {
    let coordinates = null;
    if (data.latitude && data.longitude) {
      coordinates = {
        type: 'Point',
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    const location = this.locationRepo.create({
      ...data,
      coordinates,
      created_by: reporterId,
      is_verified: false,
    });
    return this.locationRepo.save(location);
  }

  async getWifiPoints() {
    try {
      return this.locationRepo.createQueryBuilder('locations')
        .where("LOWER(locations.description) LIKE :desc", { desc: '%wifi%' })
        .orderBy('locations.created_at', 'DESC')
        .getMany();
    } catch (error) {
      this.logger.error('Error fetching WiFi points:', error.message);
      return [];
    }
  }

  async submitSpeedTest(id: string, downloadSpeed: number, uploadSpeed: number, rating: number) {
    const location = await this.locationRepo.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException('Wifi location not found');
    }

    // Update aggregate rating with the new speed-test rating
    const currentAvg = Number(location.rating_avg) || 0;
    const currentCount = location.rating_count || 0;
    const newCount = currentCount + 1;
    const newAvg = (currentAvg * currentCount + rating) / newCount;

    await this.locationRepo.update(id, {
      rating_avg: newAvg,
      rating_count: newCount,
    });

    return {
      message: 'Kết quả kiểm tra tốc độ đã được lưu',
      location_id: id,
      download_mbps: downloadSpeed,
      upload_mbps: uploadSpeed,
      rating: rating,
      updated_rating_avg: Number(newAvg.toFixed(2)),
      updated_rating_count: newCount,
    };
  }

  async getWifiPointsNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
    return this.locationRepo.createQueryBuilder('locations')
      .where(
        'ST_DWithin(locations.coordinates, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lat, lng, radius: radiusInMeters }
      )
      .andWhere("LOWER(locations.description) LIKE :desc", { desc: '%wifi%' })
      .orderBy('locations.created_at', 'DESC')
      .getMany();
  }
}
