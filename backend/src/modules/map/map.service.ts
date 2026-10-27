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

/**
 * A "ghim" (featured pin) displayed on the interactive map that links
 * directly to one of the Trải nghiệm & Tiện íu / Chợ & Đóng góp feature pages.
 * Each pin's position is sourced from the SAME backend table the feature page
 * reads from, so the pin and the feature detail stay in sync automatically
 * (the same sync model used by WiFi: locations table → /wifi page + /map page).
 */
export interface FeaturedPin {
  id: string;
  name: string;
  category: string;   // 'stem' | 'green' | 'summer' | 'wifi' | 'market' | 'donate'
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  featureLink: string; // e.g. '/stem', '/green', '/summer', '/wifi', '/marketplace', '/donate'
}

const FEATURE_LINK_MAP: Record<string, string> = {
  stem: '/stem',
  green: '/green',
  summer: '/summer',
  wifi: '/wifi',
  market: '/marketplace',
  donate: '/donate',
};

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

  // ─── In-process TTL cache for resource-optimization (HF Spaces safe) ──────
  /** TTL for cached resource-optimization results: 3600 seconds. */
  private static readonly RESOURCE_OPT_CACHE_TTL_MS = 3600 * 1000;
  /** Max entries before LRU-style eviction. */
  private static readonly RESOURCE_OPT_CACHE_MAX = 120;
  private readonly _resourceOptCache = new Map<string, { data: any; expires: number }>();

  // ─── Educational Gap Forecast: 24 h in-process cache (HF Spaces: no Redis) ─
  // Per AGENTS.md, Redis is replaced by an in-process cache on HF Spaces. The
  // predictive pipeline (Holt + DBSCAN) is CPU-bound, so caching the GeoJSON
  // result for 24 h prevents re-running it on every map view.
  private static readonly GAP_FORECAST_CACHE_TTL_MS = 24 * 3600 * 1000;
  private static readonly GAP_FORECAST_CACHE_MAX = 60;
  private readonly _gapForecastCache = new Map<string, { data: any; expires: number }>();

  /**
   * Parse a geography value that may arrive in one of several formats:
   *  - PostGIS (TypeORM): GeoJSON { type:'Point', coordinates:[lng,lat] }
   *  - SQLite / raw SQL:  EWKT string  'SRID=4326;POINT(lng lat)'
   *  - SQLite JSON column: plain JSON  '{"type":"Point","coordinates":[lng,lat]}'
   *  - Already-parsed array [lng, lat]
   * Returns [lng, lat] or null if it can't be resolved.
   */
  private parseCoords(value: any): [number, number] | null {
    if (!value) return null;
    // Already a GeoJSON object / array
    if (typeof value === 'object') {
      if (Array.isArray(value) && value.length >= 2) return [Number(value[0]), Number(value[1])];
      if (value.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
        return [Number(value.coordinates[0]), Number(value.coordinates[1])];
      }
      if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
        return [Number(value.coordinates[0]), Number(value.coordinates[1])];
      }
      if (typeof value.lat === 'number' && typeof value.lng === 'number') return [value.lng, value.lat];
      if (typeof value.lat === 'number' && typeof value.lon === 'number') return [value.lon, value.lat];
    }
    // String — could be EWKT or a JSON string
    if (typeof value === 'string') {
      // EWKT: SRID=4326;POINT(106.86965 10.98448)
      const ewktMatch = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (ewktMatch) return [Number(ewktMatch[1]), Number(ewktMatch[2])];
      // GeoJSON JSON string
      try {
        return this.parseCoords(JSON.parse(value));
      } catch { /* fall through */ }
      // NOTE: deliberately DO NOT support ambiguous "lat,lng" / "lng,lat"
      // shorthand strings — the same digit sequence can be valid coordinates
      // in two different places on Earth. Only GeoJSON [lng,lat] and EWKT are
      // accepted so a crawled record can never silently swap lat/lng.
    }
    return null;
  }

  private locationToPoi(l: Location): PointOfInterest | null {
    const coords = this.parseCoords(l.coordinates);
    if (!coords) return null;

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
    const coords = this.parseCoords(p.location);
    if (!coords) return null;

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
      lng: coords[0],
      lat: coords[1],
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
      // Chuẩn hóa viết tắt địa điểm Việt Nam trước khi so sánh tên
      .replace(/\bđh\b/g, 'đại học')
      .replace(/\bđntu\b/g, 'đại học nông lâm')
      .replace(/\bđhql\b/g, 'đại học quốc gia')
      .replace(/\btp\.?\s*hcm\b/g, 'thành phố hồ chí minh')
      .replace(/\bhcm\b/g, 'hồ chí minh')
      .replace(/\bq\.\s*/g, 'quận ')
      .replace(/\bp\.\s*/g, 'phường ')
      .replace(/\bkhu\b/g, '')
      .replace(/\bcampus\b/g, '')
      // Bỏ nội dung trong ngoặc (ví dụ "ĐNTU (Campus A)" → "đntu")
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
    const typesMap: { [key: number]: string } = { 1: 'university', 2: 'school', 3: 'library', 4: 'bookstore', 5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant', 10: 'market', 11: 'convenience' };

    if (this.isSqlite) {
      // SQLite: use raw SQL for speed (TypeORM query builder + JSON transformer is very slow on SQLite)
      // Bounds filtering is done in JS after fetch since SQLite has no PostGIS ST_Intersects.
      const raw = await this.mapPointRepo.query(
        'SELECT id, name, type_id, location, address, description, rating_avg, rating_count, status, verified FROM map_points LIMIT 5000'
      );
      let pois = raw.map((r: any) => this.mapPointToPoi({ id: r.id, name: r.name, type_id: r.type_id, type: typesMap[r.type_id] || 'other', location: r.location, address: r.address, description: r.description, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, verified: !!r.verified } as any)).filter((p): p is PointOfInterest => p !== null);
      if (bounds) pois = this.filterInBounds(pois, bounds);
      return pois;
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
      // Bounds filtering is done in JS after fetch since SQLite has no PostGIS ST_Intersects.
      const raw = await this.locationRepo.query(
        'SELECT l.id, l.name, l.category_id, l.coordinates, l.address, l.description, l.rating_avg, l.rating_count, l.status, l.is_verified, c.name as cat_name ' +
        'FROM locations l LEFT JOIN location_categories c ON l.category_id = c.id LIMIT 5000'
      );
      let pois = raw.map((r: any) => this.locationToPoi({ id: r.id, name: r.name, category: { name: r.cat_name } as any, description: r.description, coordinates: r.coordinates, address: r.address, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, is_verified: !!r.is_verified } as any)).filter((p): p is PointOfInterest => p !== null);
      if (bounds) pois = this.filterInBounds(pois, bounds);
      return pois;
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
    if (this.isSqlite) {
      // SQLite: raw SQL (TypeORM query builder + ST_Intersects doesn't exist on SQLite)
      const typesMap: { [key: number]: string } = { 1: 'university', 2: 'school', 3: 'library', 4: 'bookstore', 5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant', 10: 'market', 11: 'convenience' };
      const sql = typeId
        ? 'SELECT id, name, type_id, location, address, description, rating_avg, rating_count, status, verified FROM map_points WHERE type_id = ? LIMIT 5000'
        : 'SELECT id, name, type_id, location, address, description, rating_avg, rating_count, status, verified FROM map_points LIMIT 5000';
      const raw = typeId
        ? await this.mapPointRepo.query(sql, [typeId])
        : await this.mapPointRepo.query(sql);
      let pois = raw.map((r: any) => this.mapPointToPoi({ id: r.id, name: r.name, type_id: r.type_id, type: typesMap[r.type_id] || 'other', location: r.location, address: r.address, description: r.description, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, verified: !!r.verified } as any)).filter((p): p is PointOfInterest => p !== null);
      if (bounds) pois = this.filterInBounds(pois, bounds);
      return pois;
    }

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

  /** Filter POIs that fall within a bounding box (SQLite fallback since ST_Intersects isn't available). */
  private filterInBounds(pois: PointOfInterest[], bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): PointOfInterest[] {
    return pois.filter(p => p.lat >= bounds.minLat && p.lat <= bounds.maxLat && p.lng >= bounds.minLng && p.lng <= bounds.maxLng);
  }

  private async fetchLocationsByCategory(catLower: string, bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<PointOfInterest[]> {
    if (this.isSqlite) {
      // SQLite: raw SQL with description/category matching (no ST_Intersects)
      const likeCat = `%${catLower === 'park' ? 'green' : catLower}%`;
      const likeDesc = `%${catLower}%`;
      const likeDesc2 = `%${(catLower === 'green' || catLower === 'park') ? 'park' : catLower === 'university' ? 'college' : catLower}%`;
      const raw = await this.locationRepo.query(
        'SELECT l.id, l.name, l.category_id, l.coordinates, l.address, l.description, l.rating_avg, l.rating_count, l.status, l.is_verified, c.name as cat_name ' +
        'FROM locations l LEFT JOIN location_categories c ON l.category_id = c.id ' +
        'WHERE LOWER(c.name) LIKE ? OR LOWER(l.description) LIKE ? OR LOWER(l.description) LIKE ? LIMIT 5000',
        [likeCat, likeDesc, likeDesc2]
      );
      let pois = raw.map((r: any) => this.locationToPoi({ id: r.id, name: r.name, category: { name: r.cat_name } as any, description: r.description, coordinates: r.coordinates, address: r.address, rating_avg: r.rating_avg, rating_count: r.rating_count, status: r.status, is_verified: !!r.is_verified } as any)).filter((p): p is PointOfInterest => p !== null);
      if (bounds) pois = this.filterInBounds(pois, bounds);
      return pois;
    }

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
    // TỰ ĐỘNG NHÚNG (Embed) địa điểm/POI mới vào Vector DB ngay — thay vì
    // trigger full re-sync, chỉ nhúng POI vừa tạo để RAG tìm thấy ngay lập tức.
    try {
      const poiData = this.mapPointToPoi(saved);
      const categoryName = poiData?.category || data.category || 'Tien ich';
      const docText = `Dia diem (${categoryName}): ${saved.name}. ` +
        `Dia chi: ${saved.address || ''}, ${saved.city || ''}. ` +
        `Thong tin gioi thieu: ${saved.description || 'Dia diem thuoc he thong ban do giao duc EduMap.'}.`;
      this.httpService.post(
        `${this.aiServiceUrl}/api/ai/embed`,
        {
          text: docText,
          metadata: {
            title: saved.name,
            category: 'location',
            source: 'db_locations',
            address: saved.address || '',
            city: saved.city || '',
          },
          id: `location_${saved.id}`,
        },
        { timeout: 15000 }
      ).subscribe({
        next: () => this.logger.log(`[Auto-Embed] POI '${saved.name}' (id=${saved.id}) embedded into vector DB.`),
        error: (err: any) => this.logger.warn(`[Auto-Embed] Failed to embed POI '${saved.id}': ${err.message}`),
      });
    } catch (e) {
      // Không làm gián đoạn luồng tạo — chỉ log cảnh báo
      this.logger.warn(`Auto-embed POI failed (non-fatal): ${e}`);
    }
    return this.mapPointToPoi(saved)!;
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    // A valid, empty GeoJSON FeatureCollection used as a safe default whenever
    // the AI service cannot produce boundary polygons (Issue #7: GeoAI → GeoJSON).
    // Declared at method scope so it is reachable from both the inner and outer
    // catch blocks below (consts are block-scoped and would otherwise be
    // invisible to the outer catch).
    const emptyGeoJson = { type: 'FeatureCollection', features: [] };

    try {
      this.logger.log(`Performing AI Analysis for query: "${query}"`);
      
      const allPois = await this.findAllPois();
      const pointsData = allPois.map(p => ({
        name: p.name,
        type: p.category,
        lat: p.lat,
        lng: p.lng
      }));

      // Try AI Service first, fallback to Cloudflare direct
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, {
            city: query,
            points: pointsData,
            context: context
          }, { timeout: 45000 })
        );
        const payload = response.data;
        // Issue #7: surface the GeoJSON boundary FeatureCollection (hubs) that
        // identify_education_hubs() now produces, alongside the text analysis.
        // toFeatureCollection() also tolerates a legacy list-of-dicts / single
        // Feature shape so the frontend always gets a valid FeatureCollection.
        const geojson = this.toFeatureCollection(payload && payload.hubs);
        const analysis = (payload && payload.ai_analysis) ? payload.ai_analysis : {};
        return { ...analysis, geojson };
      } catch (aiServiceError) {
        this.logger.warn('AI Service unavailable, using Cloudflare direct');
        const analysis = await this.cloudflareAI.analyzeGeoDensity(query, pointsData);
        return { ...analysis, geojson: emptyGeoJson };
      }
    } catch (error: any) {
      this.logger.error(`Error during AI map analysis: ${error.message}`);
      return {
        summary: "Dữ liệu AI hiện không khả dụng. Dựa trên bản đồ, các cơ sở giáo dục tập trung chủ yếu quanh khuôn viên Biên Hòa.",
        density_score: 7.5,
        recommendations: [
            { area: "Cơ sở vật chất", priority: "High", reason: "Mở rộng hệ thống phòng Lab và trạm Wi-Fi công cộng." }
        ],
        geojson: emptyGeoJson,
      };
    }
  }

  /**
   * Coerce an arbitrary value into a GeoJSON FeatureCollection (Issue #7).
   * Used by callers that may receive either the new GeoJSON shape (a dict with
   * type=FeatureCollection) or a legacy list of hub dicts / a single Feature.
   */
  private toFeatureCollection(value: any): any {
    if (!value) return { type: 'FeatureCollection', features: [] };
    if (value.type === 'FeatureCollection' && Array.isArray(value.features)) return value;
    if (value.type === 'Feature') return { type: 'FeatureCollection', features: [value] };
    if (Array.isArray(value)) {
      const features = value
        .filter((f) => f && typeof f === 'object' && f.type === 'Feature')
        .map((f: any) => f as any);
      return { type: 'FeatureCollection', features };
    }
    return { type: 'FeatureCollection', features: [] };
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

  /**
   * AI Educational Gap Forecast (Idea #3).
   *
   * GET /api/map/gap-forecast?region=...&steps=... → proxies the request to the
   * ai-service POST /api/ai/forecast/gaps and caches the GeoJSON result for
   * 24 h in an in-process TTL cache (HF Spaces has no Redis).
   *
   * On ai-service failure the call degrades gracefully — it returns a valid but
   * empty/degraded GeoJSON FeatureCollection instead of throwing, so the
   * frontend map never hard-fails (matching the project's "degrade, never
   * crash" policy from AGENTS.md).
   */
  async getGapForecast(region: string | undefined, stepsAhead: number): Promise<any> {
    const key = `gap:${(region || 'all').trim().toLowerCase()}:${stepsAhead}`;
    const now = Date.now();

    const cached = this._gapForecastCache.get(key);
    if (cached && cached.expires > now) {
      this.logger.log(`gap-forecast cache hit: ${key}`);
      return { ...cached.data, cached: true };
    }
    if (cached) this._gapForecastCache.delete(key);

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/forecast/gaps`, {
          region: region || null,
          steps_ahead: stepsAhead,
        }, { timeout: 60000 })
      );
      const result = response.data || {};

      // Lazy LRU-style eviction.
      if (this._gapForecastCache.size >= MapService.GAP_FORECAST_CACHE_MAX) {
        const oldestKey = this._gapForecastCache.keys().next().value;
        if (oldestKey) this._gapForecastCache.delete(oldestKey);
      }
      this._gapForecastCache.set(key, {
        data: result,
        expires: now + MapService.GAP_FORECAST_CACHE_TTL_MS,
      });

      return result;
    } catch (error: any) {
      this.logger.error(`AI gap-forecast unavailable: ${error.message}`);
      // Degraded fallback so the UI shows a friendly warning instead of a 500.
      return {
        type: 'FeatureCollection',
        features: [],
        heat_points: [],
        risk_ranking: [],
        trends: [],
        metadata: {
          region: region || 'toàn quốc',
          method: 'holt_linear_exponential_smoothing + dbscan',
          degraded: true,
          reason: 'Dịch vụ AI dự báo khoảng trống giáo dục tạm thời không khả dụng.',
          data_points: 0,
          pois_loaded: 0,
          clusters: 0,
          steps_ahead: stepsAhead,
          last_updated: new Date().toISOString().slice(0, 10),
          forecast_horizon_years: [],
          holt_alpha: 0.3,
          holt_beta: 0.1,
        },
      };
    }
  }

  /**
   * GET /api/map/data-gaps → proxy + cache (TTL 3600 s).
   * Idea #6: Missing Data Hunter.
   *
   * Fetches live POI data from the DB, builds the points payload, and POSTs
   * them to the ai-service POST /api/ai/data/gaps (grid-based coverage +
   * attribute gap detection). Results are cached per parameter-set so
   * repeated map views are served from cache instead of recomputing the
   * grid on a 1-vCPU HF Spaces container.
   *
   * On ai-service failure: returns a valid-but-degraded GeoJSON FeatureCollection
   * so the frontend map never hard-fails (matching the "degrade, never crash"
   * policy from AGENTS.md).
   */
  async getDataGaps(params: {
    grid_size_km?: number;
    top_n?: number;
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    categories?: string[];
  }): Promise<any> {
    const gridSizeKm = params.grid_size_km ? Number(params.grid_size_km) : 1.0;
    const topN = params.top_n ? Math.max(1, Math.min(500, Number(params.top_n))) : 50;
    const categories = params.categories;
    const bounds = params.bounds;

    // Deterministic cache key from the input parameters.
    const cacheKey = `data-gaps:${gridSizeKm}:${topN}:${JSON.stringify(bounds || {})}:${JSON.stringify(categories || [])}`;

    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Data gaps cache hit: ${cacheKey}`);
      return cached.data;
    }

    // ── On cache miss: fetch POI data from the DB ──────────────────────
    let pois: PointOfInterest[] = [];
    try {
      if (bounds) {
        pois = await this.findAllPois(bounds);
      } else {
        pois = await this.findAllPois();
      }
    } catch (dbErr: any) {
      this.logger.warn(`DB fetch for data gaps failed: ${dbErr.message}`);
    }

    // Apply category filter if specified.
    let points = pois.map((p) => ({
      ...p,
      lat: p.lat,
      lng: p.lng,
    }));
    if (categories && categories.length > 0) {
      const catsLower = categories.map((c) => c.toLowerCase().trim());
      points = points.filter((p) => catsLower.includes(String(p.category || '').toLowerCase()));
    }

    // ── Proxy POST to ai-service data hunter ───────────────────────────
    const requestBody: any = {
      points: points,
      grid_size_km: gridSizeKm,
      top_n: topN,
      ...(bounds ? { bounds } : {}),
      ...(categories && categories.length > 0 ? { categories } : {}),
    };

    let result: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/data/gaps`, requestBody, { timeout: 30000 })
      );
      result = response.data || {};
    } catch (aiError: any) {
      const detail = aiError?.response?.data?.detail || aiError.message || 'AI service unavailable';
      this.logger.error(`AI data gaps failed: ${detail}`);

      // Graceful degradation: return a minimal valid GeoJSON so the frontend
      // map shows an empty-state instead of crashing.
      result = {
        type: 'FeatureCollection',
        features: [],
        summary: {
          total_cells: 0,
          gap_cells: 0,
          gap_rate: 0.0,
          total_points: points.length,
          grid_size_km: gridSizeKm,
          attribute_gaps: {},
        },
        attribute_gaps: {},
        metadata: {
          method: 'grid_based_coverage_analysis',
          degraded: true,
          reason: `Dịch vụ AI phân tích khoảng trống dữ liệu tạm thời không khả dụng: ${detail}`,
        },
      };
    }

    // Cache the result (reuse the resource-opt cache slot).
    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }

    return result;
  }

  async getFixedLocations(): Promise<PointOfInterest[]> {
    try {
      const points = await this.mapPointRepo.find({ where: { is_fixed: true } });
      return points.map(p => this.mapPointToPoi(p)).filter((p): p is PointOfInterest => p !== null);
    } catch (error: any) {
      this.logger.error(`Error getting fixed locations: ${error.message}`);
      return [];
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

  /**
   * Aggregates "ghim" (featured pins) from ALL feature tables so they appear
   * on the interactive map with direct links to their feature pages.
   *
   * This mirrors the WiFi pattern: the WiFi page reads from `locations` (LIKE
   * '%wifi%') and the map reads the same table — the pin and the feature page
   * always show the same coordinates. Here we extend that to every feature:
   *   - STEM Labs  → stem_labs.location_point  (GeoJSON, already has coords)
   *   - Green      → green_challenges.lat/lng  (new columns, backfilled)
   *   - Summer     → summer_campaigns.lat/lng (new columns, backfilled)
   *   - Wifi       → locations.coordinates      (existing, LIKE '%wifi%')
   *   - Marketplace→ shared_items.lat/lng       (new columns, backfilled)
   *   - Donate     → donation_campaigns.location_point (existing column,
   *                   backfilled for the 4 NULL rows)
   *
   * Returns pins with a `featureLink` field so the frontend popup can
   * render a "Đến" button that navigates directly to the feature page.
   */
  async getFeaturedPins(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<FeaturedPin[]> {
    try {
      const pins: FeaturedPin[] = [];

      if (this.isSqlite) {
        // --- STEM Labs ---
        const stemRaw = await this.mapPointRepo.query(
          'SELECT id, name, location_point, location_point_text as address, description FROM stem_labs WHERE location_point IS NOT NULL LIMIT 5000'
        );
        for (const r of stemRaw) {
          const coords = this.parseCoords(r.location_point);
          if (!coords) continue;
          const pin: FeaturedPin = {
            id: `stem-${r.id}`,
            name: r.name,
            category: 'stem',
            lat: coords[1],
            lng: coords[0],
            description: r.description || '',
            address: r.address || '',
            featureLink: FEATURE_LINK_MAP.stem,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // --- Green Challenges ---
        const greenRaw = await this.mapPointRepo.query(
          'SELECT id, title as name, description, lat, lng, address FROM green_challenges WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'active\' LIMIT 5000'
        );
        for (const r of greenRaw) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const pin: FeaturedPin = {
            id: `green-${r.id}`,
            name: r.name,
            category: 'green',
            lat,
            lng,
            description: r.description || '',
            address: r.address || '',
            featureLink: FEATURE_LINK_MAP.green,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // --- Summer Campaigns ---
        const summerRaw = await this.mapPointRepo.query(
          'SELECT id, name, description, location as address, lat, lng, status FROM summer_campaigns WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5000'
        );
        for (const r of summerRaw) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const pin: FeaturedPin = {
            id: `summer-${r.id}`,
            name: r.name,
            category: 'summer',
            lat,
            lng,
            description: r.description || '',
            address: r.address || r.name,
            featureLink: FEATURE_LINK_MAP.summer,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // --- Wifi (from locations table, same source as /wifi page) ---
        const wifiRaw = await this.locationRepo.query(
          'SELECT id, name, coordinates, address, description FROM locations WHERE (LOWER(description) LIKE \'%wifi%\' OR LOWER(name) LIKE \'%wifi%\') AND coordinates IS NOT NULL LIMIT 5000'
        );
        for (const r of wifiRaw) {
          const coords = this.parseCoords(r.coordinates);
          if (!coords) continue;
          const pin: FeaturedPin = {
            id: `wifi-${r.id}`,
            name: r.name,
            category: 'wifi',
            lat: coords[1],
            lng: coords[0],
            description: r.description || '',
            address: r.address || '',
            featureLink: FEATURE_LINK_MAP.wifi,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // --- Donation Campaigns (Quyên góp) ---
        const donateRaw = await this.mapPointRepo.query(
          'SELECT id, title as name, description, location_point FROM donation_campaigns WHERE location_point IS NOT NULL AND status = \'active\' LIMIT 5000'
        );
        for (const r of donateRaw) {
          const coords = this.parseCoords(r.location_point);
          if (!coords) continue;
          const pin: FeaturedPin = {
            id: `donate-${r.id}`,
            name: r.name,
            category: 'donate',
            lat: coords[1],
            lng: coords[0],
            description: r.description || '',
            address: '',
            featureLink: FEATURE_LINK_MAP.donate,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // --- Marketplace (Shared Items / Chợ trao đổi) ---
        const marketRaw = await this.mapPointRepo.query(
          'SELECT id, name, description, category, lat, lng, address FROM shared_items WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'available\' LIMIT 5000'
        );
        for (const r of marketRaw) {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const desc = r.category ? `${r.category} · ${r.description || ''}` : r.description || '';
          const pin: FeaturedPin = {
            id: `market-${r.id}`,
            name: r.name,
            category: 'market',
            lat,
            lng,
            description: desc,
            address: r.address || '',
            featureLink: FEATURE_LINK_MAP.market,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }
      } else {
        // --- Postgres mode ---
        // Stem labs
        const stemLabs = await this.mapPointRepo.query(
          'SELECT id, name, location_point, location_point_text as address, description FROM stem_labs WHERE location_point IS NOT NULL LIMIT 5000'
        );
        for (const r of stemLabs) {
          const coords = this.parseCoords(r.location_point);
          if (!coords) continue;
          const pin: FeaturedPin = {
            id: `stem-${r.id}`, name: r.name, category: 'stem',
            lat: coords[1], lng: coords[0],
            description: r.description || '', address: r.address || '',
            featureLink: FEATURE_LINK_MAP.stem,
          };
          if (!bounds || this.isInBounds(pin.lat, pin.lng, bounds)) pins.push(pin);
        }

        // Green challenges
        const greenLabs = await this.mapPointRepo.query(
          'SELECT id, title as name, description, lat, lng, address FROM green_challenges WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'active\' LIMIT 5000'
        );
        for (const r of greenLabs) {
          const lat = Number(r.lat), lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          pins.push({
            id: `green-${r.id}`, name: r.name, category: 'green',
            lat, lng, description: r.description || '', address: r.address || '',
            featureLink: FEATURE_LINK_MAP.green,
          });
        }

        // Summer campaigns
        const summerLabs = await this.mapPointRepo.query(
          'SELECT id, name, description, location as address, lat, lng FROM summer_campaigns WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5000'
        );
        for (const r of summerLabs) {
          const lat = Number(r.lat), lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          pins.push({
            id: `summer-${r.id}`, name: r.name, category: 'summer',
            lat, lng, description: r.description || '', address: r.address || r.name,
            featureLink: FEATURE_LINK_MAP.summer,
          });
        }

        // Wifi
        const wifiLabs = await this.locationRepo.query(
          'SELECT id, name, coordinates, address, description FROM locations WHERE (LOWER(description) LIKE \'%wifi%\' OR LOWER(name) LIKE \'%wifi%\') AND coordinates IS NOT NULL LIMIT 5000'
        );
        for (const r of wifiLabs) {
          const coords = this.parseCoords(r.coordinates);
          if (!coords) continue;
          pins.push({
            id: `wifi-${r.id}`, name: r.name, category: 'wifi',
            lat: coords[1], lng: coords[0],
            description: r.description || '', address: r.address || '',
            featureLink: FEATURE_LINK_MAP.wifi,
          });
        }

        // Donation campaigns
        const donateLabs = await this.mapPointRepo.query(
          'SELECT id, title as name, description, location_point FROM donation_campaigns WHERE location_point IS NOT NULL AND status = \'active\' LIMIT 5000'
        );
        for (const r of donateLabs) {
          const coords = this.parseCoords(r.location_point);
          if (!coords) continue;
          pins.push({
            id: `donate-${r.id}`, name: r.name, category: 'donate',
            lat: coords[1], lng: coords[0],
            description: r.description || '', address: '',
            featureLink: FEATURE_LINK_MAP.donate,
          });
        }

        // Marketplace (shared items)
        const marketLabs = await this.mapPointRepo.query(
          'SELECT id, name, description, category, lat, lng, address FROM shared_items WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'available\' LIMIT 5000'
        );
        for (const r of marketLabs) {
          const lat = Number(r.lat), lng = Number(r.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const desc = r.category ? `${r.category} · ${r.description || ''}` : r.description || '';
          pins.push({
            id: `market-${r.id}`, name: r.name, category: 'market',
            lat, lng, description: desc, address: r.address || '',
            featureLink: FEATURE_LINK_MAP.market,
          });
        }
      }

      return pins;
    } catch (error: any) {
      this.logger.error(`Error getting featured pins: ${error.message}`);
      return [];
    }
  }

  /** Simple bounds check used by getFeaturedPins to avoid creating POI objects for out-of-viewport pins. */
  private isInBounds(lat: number, lng: number, bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }): boolean {
    return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
  }

  // ─── Resource Optimization (MCLP) proxy + cache ──────────────────────────
  /**
   * GET /api/map/resource-optimization  →  proxy + cache (TTL 3600 s).
   *
   * Accepts query params (budget, coverage_radius_km, center_lat, center_lng,
   * region_radius_km) and returns a cached (TTL 3600 s) GeoJSON
   * FeatureCollection of A/B/C facility-placement plans + gap areas.
   * The heavy lifting (scipy MCLP) is delegated to the ai-service via
   * MapService.getResourceOptimization().
   */

  /**
   * GET /api/map/resource-optimization  →  proxy + cache (TTL 3600 s).
   *
   * Fetches live POI data from the DB, builds demand-points + candidate
   * locations, and POSTs them to the ai-service's
   * POST /api/ai/resource/optimize (MCLP solver).  Results are cached per
   * parameter-set so repeated slider values on the frontend are served from
   * cache instead of re-running scipy on a 1-vCPU HF Spaces container.
   *
   * The cache key is derived from (budget, radius, center, region) so each
   * distinct plan combination is cached independently.
   */
  async getResourceOptimization(params: {
    budget?: number;
    coverage_radius_km?: number;
    center_lat?: number;
    center_lng?: number;
    region_radius_km?: number;
  }): Promise<any> {
    const budget = Number(params.budget) || 30_000_000;
    const radius = params.coverage_radius_km ? Number(params.coverage_radius_km) : undefined;
    const centerLat = params.center_lat ? Number(params.center_lat) : 10.9567;
    const centerLng = params.center_lng ? Number(params.center_lng) : 107.1825;
    const regionRadius = params.region_radius_km ? Number(params.region_radius_km) : 10;

    // Build a deterministic cache key from the input parameters.
    const cacheKey = `resource-opt:${budget}:${radius ?? 'auto'}:${centerLat}:${centerLng}:${regionRadius}`;

    // Check in-process TTL cache — return immediately on hit (no DB/ai-service round-trip).
    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Resource optimization cache hit: ${cacheKey}`);
      return cached.data;
    }

    // ── On cache miss: fetch POI data from the DB ──────────────────────
    let pois: PointOfInterest[] = [];
    try {
      pois = await this.findAllPois();
    } catch (dbErr: any) {
      this.logger.warn(`DB fetch for resource optimization failed: ${dbErr.message}`);
    }

    // Build demand_points (weighted by rating as a proxy for importance)
    const demandPoints = pois.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      address: p.address || '',
      weight: Math.max(10, (p.rating_avg || 3) * 20),
    }));

    // Candidate locations come from existing POIs — expanding/adding facilities
    // at sites that already have educational infrastructure is realistic.
    const candidateLocations = pois.map((p) => {
      const ftype = p.category === 'wifi' ? 'wifi'
        : p.category === 'lab' || p.category === 'stem' ? 'computer'
        : p.category === 'library' ? 'library'
        : 'study_space';
      return {
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        facility_type: ftype,
        address: p.address || '',
        description: p.description || '',
      };
    });

    // ── Proxy POST to ai-service MCLP solver ───────────────────────────
    const requestBody: any = {
      budget,
      center: { lat: centerLat, lng: centerLng },
      region_radius_km: regionRadius,
      demand_points: demandPoints,
      candidate_locations: candidateLocations,
    };
    if (radius) requestBody.coverage_radius_km = radius;

    let result: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/resource/optimize`, requestBody, { timeout: 30000 })
      );
      result = response.data || {};
    } catch (aiError: any) {
      const detail = aiError?.response?.data?.detail || aiError.message || 'AI service unavailable';
      this.logger.error(`AI resource optimize failed: ${detail}`);

      // Graceful degradation: return a minimal valid GeoJSON so the frontend
      // map doesn't crash — it can show a "no data" state instead of erroring.
      result = {
        type: 'FeatureCollection',
        features: [],
        plans: {
          A: { selected: 0, total_cost: 0, total_served: 0, total_demand: pois.length, coverage_pct: 0, budget_used_pct: 0, budget, solver: 'none' },
          B: { selected: 0, total_cost: 0, total_served: 0, total_demand: pois.length, coverage_pct: 0, budget_used_pct: 0, budget: budget * 0.7, solver: 'none' },
          C: { selected: 0, total_cost: 0, total_served: 0, total_demand: pois.length, coverage_pct: 0, budget_used_pct: 0, budget: budget * 1.0, solver: 'none' },
        },
        gaps: { type: 'FeatureCollection', features: [] },
        summary: {
          budget, candidate_count: candidateLocations.length,
          demand_count: demandPoints.length, pre_filtered: false,
          elapsed_ms: 0, best_plan: 'C', note: `Fallback: ${detail}`,
        },
        status: 'degraded',
      };
    }

    // Cache the result for subsequent identical requests (TTL 3600 s).
    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });

    // Simple LRU-style eviction: drop oldest entry when over capacity.
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Talk2Map (Idea #4): NL → GIS query
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST/GET /api/map/nl-search?q=<vietnamese query>
   *
   * 1. Calls the ai-service POST /api/ai/map/query to parse the Vietnamese
   *    natural-language query into structured entities (facility types,
   *    conditions, radius, location reference).
   * 2. Queries SQLite for matching POIs.
   * 3. Filters by detected conditions (wifi, free, parking, etc.).
   * 4. Returns `{ query, parsed_query, explanation, degraded, results, total }`.
   *
   * On ai-service failure: falls back to a regex keyword parse + basic
   * category filter so Talk2Map keeps working on HF Spaces when LLM
   * providers are unreachable.
   */
  async nLSearch(query: string, limit: number = 20): Promise<any> {
    // ── 1. Parse the Vietnamese query via ai-service ───────────────────
    let parsedQuery: any = null;
    let explanation = '';
    let degraded = false;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/map/query`,
          { text: query },
          { timeout: 15000 }
        )
      );
      const payload = response.data || {};
      parsedQuery = payload.parsed_query || payload;
      explanation = payload.explanation || '';
      degraded = payload.degraded || false;
    } catch (aiError: any) {
      this.logger.warn(
        `AI service unavailable for nl-search, using keyword fallback: ${aiError.message}`
      );
      parsedQuery = this._fallbackParse(query);
      explanation = `Tìm kiếm: "${query}"`;
      degraded = true;
    }

    // ── 2. Query SQLite for matching POIs ───────────────────────────────
    let pois: PointOfInterest[] = [];
    try {
      const facilityTypes: string[] = parsedQuery?.facility_types || [];
      const allPois =
        facilityTypes.length > 0
          ? await this._findPoisByCategories(facilityTypes)
          : await this.findAllPois();

      // ── 3. Apply condition filters ────────────────────────────────
      const conditions: string[] = parsedQuery?.conditions || [];
      pois = this._filterByConditions(allPois, conditions);

      // ── 4. Deduplicate + sort by rating ────────────────────────────
      pois = this.deduplicatePois(pois);
      pois.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
      pois = pois.slice(0, limit);
    } catch (dbError: any) {
      this.logger.error(`Error querying POIs for nl-search: ${dbError.message}`);
    }

    // ── 5. Return combined result ─────────────────────────────────────
    return {
      query,
      parsed_query: parsedQuery,
      explanation,
      degraded,
      results: pois,
      total: pois.length,
    };
  }

  /**
   * Regex-only fallback parser used when the ai-service is unreachable.
   * Mirrors the keyword dictionaries in ai-service/services/nl_query_parser.py
   * but in TypeScript so the backend can self-serve on HF Spaces.
   */
  private _fallbackParse(query: string): Record<string, any> {
    const text = query.toLowerCase().trim();
    const facilities: string[] = [];
    const conditions: string[] = [];

    if (/\b(trường|truồng|trường học|thpt|thcs)\b/.test(text)) facilities.push('school');
    if (/\bđại học|\bđh\b/.test(text)) facilities.push('university');
    if (/\b(thư viện|thư viên)\b/.test(text)) facilities.push('library');
    if (/\b(cà phê|càphê|cafe)\b/.test(text)) facilities.push('cafe');
    if (/\b(chợ|thị trường|siêu thị)\b/.test(text)) facilities.push('market');
    if (/\b(nhà hàng|quán ăn|đồ ăn)\b/.test(text)) facilities.push('restaurant');
    if (/\b(công viên|khu xanh|vườn)\b/.test(text)) facilities.push('green');
    if (/\b(wifi|internet)\b/.test(text)) facilities.push('wifi');

    if (/\b(miễn phí|free)\b/.test(text)) conditions.push('free');
    if (/\b(wifi|internet)\b/.test(text)) conditions.push('wifi');
    if (/\b(tối|đêm|24\/7|24h)\b/.test(text)) conditions.push('open_evening');
    if (/\b(đậu xe|parking|chỗ đỗ)\b/.test(text)) conditions.push('parking');
    if (/\b(yên tĩch)\b/.test(text)) conditions.push('quiet');
    if (/\b(bàn ghế)\b/.test(text)) conditions.push('bench');

    let location: string | null = null;
    if (/\bbiên hòa/.test(text)) location = 'Biên Hòa';
    else if (/\b(hồ chí minh|tphcm)\b/.test(text)) location = 'TP. Hồ Chí Minh';
    else if (/\bhà nội\b/.test(text)) location = 'Hà Nội';
    else if (/\bđà nẵng\b/.test(text)) location = 'Đà Nẵng';
    if (/\bmiền nam\b/.test(text)) location = 'Miền Nam';
    else if (/\bmiền bắc\b/.test(text)) location = 'Miền Bắc';
    else if (/\bmiền trung\b/.test(text)) location = 'Miền Trung';
    if (/\bđông nam bộ\b/.test(text)) location = 'Đông Nam Bộ';

    return {
      location,
      radius_km: /\bgần\b/.test(text) ? 3.0 : /\b(rộng|toàn)\b/.test(text) ? 10.0 : 5.0,
      facility_types: facilities,
      conditions,
      reference_location: null,
      confidence: 0.3,
      method: 'regex',
      suggestions: [],
      raw_text: query,
    };
  }

  /** Fetch POIs for multiple categories (union), then deduplicate. */
  private async _findPoisByCategories(categories: string[]): Promise<PointOfInterest[]> {
    const seen = new Set<string>();
    const all: PointOfInterest[] = [];
    for (const cat of categories) {
      const pois = await this.findPoisByCategory(cat);
      for (const p of pois) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          all.push(p);
        }
      }
    }
    return all;
  }

  /**
   * Filter POIs by detected conditions (regex-level heuristics).
   * Conditions that cannot be reliably checked (open_evening, open_now)
   * are pass-through so they don't over-filter results.
   */
  private _filterByConditions(pois: PointOfInterest[], conditions: string[]): PointOfInterest[] {
    if (!conditions || conditions.length === 0) return pois;

    return pois.filter((poi) => {
      const desc = (poi.description || '').toLowerCase();
      const name = (poi.name || '').toLowerCase();
      const cat = (poi.category || '').toLowerCase();
      const address = (poi.address || '').toLowerCase();
      const combined = `${desc} ${name} ${address}`;

      for (const cond of conditions) {
        if (cond === 'wifi') {
          if (cat !== 'wifi' && !combined.includes('wifi') && !combined.includes('internet')) return false;
        } else if (cond === 'free') {
          // Free categories (library, green, park) OR explicit "miễn phí" in description
          if (!['library', 'green', 'park'].includes(cat) && !combined.includes('miễn phí') && !combined.includes('free')) return false;
        } else if (cond === 'parking') {
          if (!combined.includes('đậu xe') && !combined.includes('parking') && !combined.includes('chỗ đỗ')) return false;
        } else if (cond === 'quiet') {
          if (!combined.includes('yên tĩch') && !combined.includes('thích hợp học')) return false;
        } else if (cond === 'cafe') {
          if (cat !== 'cafe' && !combined.includes('cà phê') && !combined.includes('cafe')) return false;
        } else if (cond === 'bench') {
          if (!combined.includes('bàn ghế') && !combined.includes('ghế')) return false;
        } else if (cond === 'aircon') {
          if (!combined.includes('điều hòa') && !combined.includes('máy lạnh')) return false;
        }
        // open_evening, open_now: pass-through (no reliable opening-hours data)
      }

      return true;
    });
  }
}
