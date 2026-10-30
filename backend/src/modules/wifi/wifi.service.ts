import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../map/entities/location.entity';
import { isPostgresNow } from '../../common/utils/db-column.utils';

/**
 * `location_categories.id = 6` is the dedicated `wifi_hotspot` category
 * (see `backend/src/database/seed.sql`). The wifi feature must return ONLY
 * rows in this category — NOT every `locations` row whose free-text
 * `description` happens to contain the substring "wifi"
 * (e.g. a university described as `wifi_education`, or a library as
 * `wifi_provincial_library`). Those are generic map POIs that merely *have*
 * wifi as an amenity; surfacing them under the Wifi tool is what made the
 * Wifi tool display look "combined with" the main map browse (the same
 * schools/libraries/hospitals showed up under "Trạm Wifi").
 */
const WIFI_CATEGORY_ID = 6;

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
        // Only dedicated wifi hotspots (category_id = 6), never generic POIs
        // that merely mention "wifi" in their description — those belong to the
        // main map browse, not the Wifi tool.
        .where("locations.category_id = :wifiCategory", { wifiCategory: WIFI_CATEGORY_ID })
        .orderBy('locations.created_at', 'DESC')
        .getMany();
    } catch (error: any) {
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

  /**
   * Extract [lng, lat] from a Location.coordinates value.
   * Postgres+PostGIS returns a GeoJSON object; SQLite stores the same JSON as
   * text. Anything malformed is skipped rather than throwing (a single bad row
   * must not turn the endpoint into a 500).
   */
  private _parseLngLat(raw: any): [number, number] | null {
    let value = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return null;
      }
    }
    const coords = value?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
  }

  /** Great-circle distance in metres (Haversine, R = 6371000 m). */
  private _haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  async getWifiPointsNearby(lat: number, lng: number, radiusInMeters: number = 5000) {
    const radius =
      Number.isFinite(radiusInMeters) && radiusInMeters > 0 ? radiusInMeters : 5000;

    // Missing/invalid coordinates must not reach the query builder: with
    // PostGIS that produced a 500, and with SQLite it silently matched nothing.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Toạ độ không hợp lệ: cần lat và lng là số.');
    }

    if (isPostgresNow()) {
      return this.locationRepo.createQueryBuilder('locations')
        .where(
          'ST_DWithin(locations.coordinates, ST_MakePoint(:lng, :lat)::geography, :radius)',
          { lat, lng, radius },
        )
        // Dedicated wifi hotspots only (category_id = 6); see getWifiPoints().
        .andWhere("locations.category_id = :wifiCategory", { wifiCategory: WIFI_CATEGORY_ID })
        .orderBy('locations.created_at', 'DESC')
        .getMany();
    }

    // ── SQLite / no-PostGIS path ───────────────────────────────────────────
    // `locations.coordinates` is JSON text on SQLite: there is no ST_DWithin,
    // ST_MakePoint or `::geography` cast, so the old raw query failed with
    // `SQLITE_ERROR: unrecognized token: ":"` (named Postgres params were also
    // passed through). Load the dedicated wifi-hotspot rows (category_id = 6)
    // and filter with Haversine. The row count is tiny (wifi hotspots only),
    // so this stays sub-10ms.
    const candidates = await this.locationRepo
      .createQueryBuilder('locations')
      .where('locations.category_id = :wifiCategory', { wifiCategory: WIFI_CATEGORY_ID })
      .getMany();

    const nearby = candidates
      .map((location) => {
        const point = this._parseLngLat(location.coordinates);
        if (!point) return null;
        const distance_m = Math.round(
          this._haversineMeters(lat, lng, point[1], point[0]),
        );
        return { ...location, distance_m };
      })
      .filter((item): item is any => !!item && item.distance_m <= radius)
      .sort((a, b) => a.distance_m - b.distance_m);

    return nearby;
  }
}
