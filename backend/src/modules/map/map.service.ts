import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';
import { CloudflareAIService } from '../../services/cloudflare-ai.service';

export interface PointOfInterest {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  rating_avg?: number;
  rating_count?: number;
  status?: string;
  verified?: boolean;
}

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);
  private readonly aiServiceUrl: string;

  constructor(
    @InjectRepository(MapPoint)
    private readonly mapPointRepo: Repository<MapPoint>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cloudflareAI: CloudflareAIService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
    this.isSqlite = process.env.DB_TYPE === 'sqlite';
    this.logger.log(`MapService initialized. isSqlite=${this.isSqlite}, DB_SQLITE_PATH=${process.env.DB_SQLITE_PATH}`);
  }

  private locationToPoi(l: Location): PointOfInterest | null {
    if (!l.coordinates || typeof l.coordinates !== 'object') return null;
    const coords = l.coordinates.coordinates || [];
    if (!Array.isArray(coords) || coords.length < 2) return null;

    let categoryStr = 'other';
    if (l.category?.name) {
      categoryStr = l.category.name.toLowerCase();
    } else if (l.description) {
      const descLower = l.description.toLowerCase();
      if (descLower.includes('wifi')) categoryStr = 'wifi';
      else if (descLower.includes('green') || descLower.includes('park')) categoryStr = 'green';
      else if (descLower.includes('cafe')) categoryStr = 'cafe';
      else if (descLower.includes('school')) categoryStr = 'school';
      else if (descLower.includes('university') || descLower.includes('college')) categoryStr = 'university';
      else if (descLower.includes('library')) categoryStr = 'library';
      else if (descLower.includes('lab') || descLower.includes('stem')) categoryStr = 'lab';
      else if (descLower.includes('restaurant') || descLower.includes('food') || descLower.includes('fast_food')) categoryStr = 'restaurant';
    }

    return {
      id: l.id,
      name: l.name,
      category: categoryStr,
      lng: coords[0],
      lat: coords[1],
      address: l.address,
      description: l.description,
      rating_avg: l.rating_avg,
      rating_count: l.rating_count,
      status: l.status,
      verified: l.is_verified ?? false,
    };
  }

  private mapPointToPoi(p: MapPoint): PointOfInterest | null {
    if (!p.location || p.location.type !== 'Point' || !Array.isArray(p.location.coordinates) || p.location.coordinates.length < 2) {
      return null;
    }
    
    let categoryStr = p.type;
    if ((!categoryStr || categoryStr === 'other') && p.description) {
      const descLower = p.description.toLowerCase();
      if (descLower.includes('wifi')) categoryStr = 'wifi';
      else if (descLower.includes('green') || descLower.includes('park')) categoryStr = 'green';
      else if (descLower.includes('cafe')) categoryStr = 'cafe';
      else if (descLower.includes('school')) categoryStr = 'school';
      else if (descLower.includes('university') || descLower.includes('college')) categoryStr = 'university';
      else if (descLower.includes('library')) categoryStr = 'library';
      else if (descLower.includes('lab') || descLower.includes('stem')) categoryStr = 'lab';
      else if (descLower.includes('restaurant') || descLower.includes('food')) categoryStr = 'restaurant';
    }

    return {
      id: p.id,
      name: p.name,
      category: categoryStr || 'other',
      lng: p.location.coordinates[0],
      lat: p.location.coordinates[1],
      address: p.address,
      description: p.description,
      rating_avg: p.rating_avg,
      rating_count: p.rating_count,
      status: p.status,
      verified: p.verified,
    };
  }

  /**
   * Normalize a POI name for deduplication: lowercase, strip parenthetical
   * suffixes (e.g. "DNTU (Campus A)" → "dntu"), trim.
   */
  private normalizePoiName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Simple Levenshtein-based name similarity ratio [0,1].
   * Two names are considered equivalent if ratio >= 0.8.
   */
  private nameSimilarity(a: string, b: string): number {
    const sa = this.normalizePoiName(a);
    const sb = this.normalizePoiName(b);
    if (sa === sb) return 1;
    if (!sa || !sb) return 0;
    const longer = sa.length > sb.length ? sa : sb;
    const shorter = sa.length > sb.length ? sb : sa;
    if (longer.length === 0) return 1;
    const editDist = this.levenshtein(longer, shorter);
    return (longer.length - editDist) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const m: number[][] = Array(b.length + 1).fill(0).map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) m[0][i] = i;
    for (let j = 0; j <= b.length; j++) m[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        if (a[i - 1] === b[j - 1]) m[j][i] = m[j - 1][i - 1];
        else m[j][i] = Math.min(m[j - 1][i], m[j][i - 1], m[j - 1][i - 1]) + 1;
      }
    }
    return m[b.length][a.length];
  }

  /** Haversine distance in metres between two lat/lng pairs. */
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  }

  /**
   * Deduplicate POIs from both tables. Entries from `map_points` (manually
   * verified, `verified=true`) are prioritized over `locations` (crawled,
   * may have coordinate drift). Two POIs are considered duplicates when:
   *  - Their *exact* normalised names match (handles crawled coordinate drift), OR
   *  - Their names are similar (≥80%) AND they are within 200 m of each other.
   */
  private deduplicatePois(allPois: PointOfInterest[]): PointOfInterest[] {
    // Sort so verified/approved map_points come first (kept over nearby duplicates)
    const sorted = [...allPois].sort((a, b) => {
      const score = (p: PointOfInterest) => (p.verified ? 2 : 0) + (p.status === 'approved' ? 1 : 0);
      return score(b) - score(a);
    });

    // Spatial grid (~1.1 km cells) so we only Levenshtein-compare nearby POIs — O(n·k) instead of O(n²)
    const CELL_SIZE = 0.01;
    const grid: Map<string, PointOfInterest[]> = new Map();
    const unique: PointOfInterest[] = [];

    const cellKey = (lat: number, lng: number) =>
      `${Math.floor(lat / CELL_SIZE)},${Math.floor(lng / CELL_SIZE)}`;

    for (const poi of sorted) {
      const key = cellKey(poi.lat, poi.lng);
      const latBase = parseInt(key.split(',')[0]);
      const lngBase = parseInt(key.split(',')[1]);

      // Gather candidates from same + 8 adjacent cells
      const candidates: PointOfInterest[] = [];
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLng = -1; dLng <= 1; dLng++) {
          const adjKey = `${latBase + dLat},${lngBase + dLng}`;
          const cell = grid.get(adjKey);
          if (cell) candidates.push(...cell);
        }
      }

      const isDup = candidates.some(ex => {
        // Deliberately NOT deduping on shared UUID alone: the same id can exist
        // in both `map_points` (verified) and `locations` (crawled) with drifted
        // coordinates. Identity here is resolved by name+geometry; any surviving
        // same-id collision is collapsed deterministically by `mergeDuplicateIds`
        // (verified coordinate always wins) so a POI's position never jumps
        // between renders — which is what caused the "click DNTU → lands on
        // Lotte" mis-jump on SQLite.
        const normEx = this.normalizePoiName(ex.name);
        const normPoi = this.normalizePoiName(poi.name);
        if (normEx && normPoi && normEx === normPoi) return true; // exact name → dup
        if (this.haversine(ex.lat, ex.lng, poi.lat, poi.lng) < 200) {
          return this.nameSimilarity(ex.name, poi.name) >= 0.8;
        }
        return false;
      });
      if (!isDup) {
        unique.push(poi);
        const cell = grid.get(key) || [];
        cell.push(poi);
        grid.set(key, cell);
      }
    }
    return unique;
  }

  /**
   * Coordinate-stable id collapse. `map_points` and `locations` can share a
   * UUID for the same landmark; when a crawled row drifts, the SAME id may
   * carry different coordinates in the two tables. The frontend renders markers
   * with `key={p.id}`, so two records for one id would make React reuse a
   * single marker DOM node and silently paint the "other" coordinate — making
   * the selected POI visibly jump between renders. Collapse each id to exactly
   * one record, always preferring the verified `map_points` source (sorted
   * first by `deduplicatePois`) so the position is stable regardless of which
   * table the refetch returned first.
   */
  private mergeDuplicateIds(pois: PointOfInterest[]): PointOfInterest[] {
    const score = (p: PointOfInterest) => (p.verified ? 2 : 0) + (p.status === 'approved' ? 1 : 0);
    const byId = new Map<string, PointOfInterest>();
    for (const poi of pois) {
      const existing = byId.get(poi.id);
      if (!existing) {
        byId.set(poi.id, poi);
      } else if (score(poi) > score(existing)) {
        byId.set(poi.id, poi);
      }
    }
    return Array.from(byId.values());
  }

  async findAllPois(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    // Fetch from both map_points and locations tables for proper data sync
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPoints(bounds),
      this.fetchLocations(bounds)
    ]);

    // Merge and deduplicate by name+geometry, then collapse any surviving
    // duplicate UUIDs (shared between map_points and locations) deterministically
    // so a given id never resolves to two different coordinates across renders.
    // map_points (verified) are sorted first so their coordinates win.
    const allPois = [...mapPoints, ...locations];
    return this.mergeDuplicateIds(this.deduplicatePois(allPois));
  }

  private isSqlite: boolean;

  private async fetchMapPoints(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    if (this.isSqlite) {
      // SQLite: use raw SQL for speed (TypeORM query builder + JSON transformer is very slow on SQLite)
      const raw = await this.mapPointRepo.query(
        'SELECT id, name, type_id, location, address, description, rating_avg, rating_count, status, verified FROM map_points LIMIT 5000'
      );
      const typesMap: { [key: number]: string } = { 1: 'university', 2: 'school', 3: 'library', 4: 'bookstore', 5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant', 10: 'market', 11: 'convenience' };
      return raw.map((r: any) => this.mapPointToPoi({ id: r.id, name: r.name, type_id: r.type_id, type: typesMap[r.type_id] || 'other', location: typeof r.location === 'string' ? JSON.parse(r.location) : r.location, address: r.address, description: r.description, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, verified: !!r.verified } as any)).filter((p): p is PointOfInterest => p !== null);
    }

    let query = this.mapPointRepo.createQueryBuilder('map_points');

    if (bounds) {
      query = query.where(
        `ST_Intersects(map_points.location, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
        { ...bounds }
      );
    }

    query = query.limit(5000);
    const points = await query.getMany();
    return points.map(p => this.mapPointToPoi(p)).filter((p): p is PointOfInterest => p !== null);
  }

  private async fetchLocations(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    if (this.isSqlite) {
      // SQLite: use raw SQL (leftJoinAndSelect with JSON columns is extremely slow)
      const raw = await this.locationRepo.query(
        'SELECT l.id, l.name, l.category_id, l.coordinates, l.address, l.description, l.rating_avg, l.rating_count, l.status, l.is_verified, c.name as cat_name ' +
        'FROM locations l LEFT JOIN location_categories c ON l.category_id = c.id LIMIT 5000'
      );
      return raw.map((r: any) => this.locationToPoi({ id: r.id, name: r.name, category: { name: r.cat_name } as any, description: r.description, coordinates: typeof r.coordinates === 'string' ? JSON.parse(r.coordinates) : r.coordinates, address: r.address, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, is_verified: !!r.is_verified } as any)).filter((p): p is PointOfInterest => p !== null);
    }

    let query = this.locationRepo.createQueryBuilder('locations')
      .leftJoinAndSelect('locations.category', 'category');

    if (bounds) {
      query = query.where(
        `ST_Intersects(locations.coordinates, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
        { ...bounds }
      );
    }

    query = query.limit(5000);
    const locations = await query.getMany();
    return locations.map(l => this.locationToPoi(l)).filter((p): p is PointOfInterest => p !== null);
  }

  async findPoisByCategory(category: string, bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<PointOfInterest[]> {
    const typeIdsMap: { [key: string]: number } = {
      'university': 1,
      'school': 2,
      'library': 3,
      'bookstore': 4,
      'lab': 5,
      'wifi': 6,
      'green': 7,
      'cafe': 8,
      'restaurant': 9,
      'market': 10,
      'convenience': 11,
      'park': 7,
    };
    
    const catLower = category.toLowerCase();
    const typeId = typeIdsMap[catLower];
    
    // Fetch from both tables
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPointsByCategory(typeId, catLower, bounds),
      this.fetchLocationsByCategory(catLower, bounds)
    ]);
    
    // Merge and deduplicate by id AND name+proximity (map_points verified first)
    const allPois = [...mapPoints, ...locations];
    return this.deduplicatePois(allPois);
  }

  private async fetchMapPointsByCategory(typeId: number | undefined, catLower: string, bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<PointOfInterest[]> {
    let query = this.mapPointRepo.createQueryBuilder('map_points');
    
    if (typeId) {
      query = query.where('map_points.type_id = :typeId', { typeId })
                   .orWhere('LOWER(map_points.description) LIKE :desc', { desc: `%${catLower}%` })
                   .orWhere('LOWER(map_points.description) LIKE :desc2', { desc2: `%${(catLower === 'green' || catLower === 'park') ? 'park' : catLower === 'university' ? 'college' : catLower}%` });
    } else {
      query = query.where('LOWER(map_points.description) LIKE :desc', { desc: `%${catLower}%` });
    }
    if (bounds) {
      query = query.andWhere(
        `ST_Intersects(map_points.location, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
        { ...bounds }
      );
    }
    const points = await query.getMany();
    return points.map(p => this.mapPointToPoi(p)).filter((p): p is PointOfInterest => p !== null);
  }

  private async fetchLocationsByCategory(catLower: string, bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<PointOfInterest[]> {
    let query = this.locationRepo.createQueryBuilder('locations')
      .leftJoinAndSelect('locations.category', 'category')
      .where(
        `(LOWER(category.name) LIKE :cat OR LOWER(locations.description) LIKE :desc OR LOWER(locations.description) LIKE :desc2)`,
        { cat: `%${catLower === 'park' ? 'green' : catLower}%`, desc: `%${catLower}%`, desc2: `%${(catLower === 'green' || catLower === 'park') ? 'park' : catLower === 'university' ? 'college' : catLower}%` }
      )
      .limit(2000);
    if (bounds) {
      query = query.andWhere(
        `ST_Intersects(locations.coordinates, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
        { ...bounds }
      );
    }
    
    const locations = await query.getMany();
    return locations.map(l => this.locationToPoi(l)).filter((p): p is PointOfInterest => p !== null);
  }

  async getCategories(): Promise<string[]> {
    return ['university', 'school', 'library', 'bookstore', 'lab', 'wifi', 'green', 'cafe', 'restaurant', 'market', 'convenience', 'park'];
  }

  async createPoi(data: any): Promise<PointOfInterest> {
    const typeIdsMap: { [key: string]: number } = {
      'university': 1,
      'school': 2,
      'library': 3,
      'bookstore': 4,
      'lab': 5,
      'wifi': 6,
      'green': 7,
      'cafe': 8,
      'restaurant': 9,
      'market': 10,
      'convenience': 11,
      'park': 7,
    };

    const point = this.mapPointRepo.create({
      name: data.name,
      description: data.description,
      address: data.address,
      type: data.category,
      type_id: typeIdsMap[data.category.toLowerCase()] || 0,
      status: 'pending',
      location: {
        type: 'Point',
        coordinates: [data.lng, data.lat]
      }
    });

    const saved = await this.mapPointRepo.save(point);
    try {
      this.httpService.post(`${this.aiServiceUrl}/api/ai/sync-knowledge/?background=true`, {}, { timeout: 3000 }).subscribe({
        error: (err) => this.logger.warn(`Failed to auto-sync AI knowledge: ${err.message}`),
      });
    } catch (e) {
      // Ignore background sync trigger error
    }
    return this.mapPointToPoi(saved)!;
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    try {
      this.logger.log(`Performing AI Analysis for query: "${query}"`);
      
      const allPois = await this.findAllPois();
      const pointsData = allPois.map(p => ({
        name: p.name,
        type: p.category,
        lat: p.lat,
        lng: p.lng
      }));

      // Try AI Service first, fallback to Gemini
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze/`, {
            city: query,
            points: pointsData,
            context: context
          })
        );
        return response.data.ai_analysis || response.data;
      } catch (aiServiceError) {
        this.logger.warn('AI Service unavailable, using Cloudflare direct');
        return this.cloudflareAI.analyzeGeoDensity(query, pointsData);
      }
    } catch (error: any) {
      this.logger.error(`Error during AI map analysis: ${error.message}`);
      return {
        summary: "Dữ liệu AI hiện không khả dụng. Dựa trên bản đồ, các cơ sở giáo dục tập trung chủ yếu quanh khuôn viên Biên Hòa.",
        density_score: 7.5,
        recommendations: [
            { area: "Cơ sở vật chất", priority: "High", reason: "Mở rộng hệ thống phòng Lab và trạm Wi-Fi công cộng." }
        ]
      };
    }
  }

  async getStats(): Promise<{ total: number; categories: Record<string, number> }> {
    try {
      const allPois = await this.findAllPois();
      const stats: Record<string, number> = {};
      for (const poi of allPois) {
        const cat = poi.category || 'other';
        stats[cat] = (stats[cat] || 0) + 1;
      }
      return { total: allPois.length, categories: stats };
    } catch (error: any) {
      this.logger.error(`Error getting map stats: ${error.message}`);
      return { total: 0, categories: {} };
    }
  }

  async getPoiDetails(id: string): Promise<{ poi: PointOfInterest | null; nearby: PointOfInterest[] }> {
    let poi: PointOfInterest | null = null;
    const mp = await this.mapPointRepo.findOne({ where: { id } });
    if (mp) poi = this.mapPointToPoi(mp);
    if (!poi) {
      const loc = await this.locationRepo.findOne({ where: { id }, relations: ['category'] });
      if (loc) poi = this.locationToPoi(loc);
    }
    if (!poi) return { poi: null, nearby: [] };
    const nearby = await this.findAllPois({
      minLat: poi.lat - 0.02, maxLat: poi.lat + 0.02,
      minLng: poi.lng - 0.02, maxLng: poi.lng + 0.02,
    });
    return {
      poi,
      nearby: nearby.filter((p) => p.id !== poi!.id).slice(0, 12),
    };
  }
}
