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
      is_free: data.is_free !== undefined ? data.is_free : true,
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
