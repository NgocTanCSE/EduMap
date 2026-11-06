import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../map/entities/location.entity';
const WIFI_CATEGORY_ID = 6;
@Injectable()
export class WifiService {
    private readonly logger = new Logger(WifiService.name);
    constructor(
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>) { }
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
                .where("locations.category_id = :wifiCategory", { wifiCategory: WIFI_CATEGORY_ID })
                .orderBy('locations.created_at', 'DESC')
                .getMany();
        }
        catch (error: any) {
            this.logger.error('Error fetching WiFi points:', error.message);
            return [];
        }
    }
    async submitSpeedTest(id: string, downloadSpeed: number, uploadSpeed: number, rating: number) {
        const location = await this.locationRepo.findOne({ where: { id } });
        if (!location) {
            throw new NotFoundException('Wifi location not found');
        }
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
    private _parseLngLat(raw: any): [
        number,
        number
    ] | null {
        let value = raw;
        if (typeof value === 'string') {
            try {
                value = JSON.parse(value);
            }
            catch {
                return null;
            }
        }
        const coords = value?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
            return null;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            return null;
        return [lng, lat];
    }
    private _haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371000;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }
    async getWifiPointsNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
        const radius = Number.isFinite(radiusInMeters) && radiusInMeters > 0 ? radiusInMeters : 5000;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new BadRequestException('Toạ độ không hợp lệ: cần lat và lng là số.');
        }
        return this.locationRepo.createQueryBuilder('locations')
      .where(
        'ST_DWithin(locations.coordinates, ST_MakePoint(:lng, :lat)::geography, :radius)',
        { lat, lng, radius },
      )
      .andWhere("locations.category_id = :wifiCategory", { wifiCategory: WIFI_CATEGORY_ID })
      .orderBy('locations.created_at', 'DESC')
      .getMany();
  }
}
