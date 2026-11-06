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


export interface FeaturedPin {
  id: string;
  name: string;
  category: string;   
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  featureLink: string; 
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
    this.logger.log(`MapService initialized. DB_SQLITE_PATH=${process.env.DB_SQLITE_PATH}`);
  }

  
  
  private static readonly RESOURCE_OPT_CACHE_TTL_MS = 3600 * 1000;
  
  private static readonly RESOURCE_OPT_CACHE_MAX = 120;
  private readonly _resourceOptCache = new Map<string, { data: any; expires: number }>();

  
  
  
  
  private static readonly GAP_FORECAST_CACHE_TTL_MS = 24 * 3600 * 1000;
  private static readonly GAP_FORECAST_CACHE_MAX = 60;
  private readonly _gapForecastCache = new Map<string, { data: any; expires: number }>();

  
  
  
  
  
  private static readonly POI_CACHE_TTL_MS = 300 * 1000;
  private static readonly POI_CACHE_MAX = 80;
  private readonly _poiCache = new Map<string, { data: any; expires: number }>();

  
  private parseCoords(value: any): [number, number] | null {
    if (!value) return null;
    
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
    
    if (typeof value === 'string') {
      
      const ewktMatch = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (ewktMatch) return [Number(ewktMatch[1]), Number(ewktMatch[2])];
      
      try {
        return this.parseCoords(JSON.parse(value));
      } catch {  }
      
      
      
      
    }
    return null;
  }

  
  private isValidLatLng(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90
      && lng >= -180 && lng <= 180;
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

  
  private normalizePoiName(name: string): string {
    return (name || '')
      .toLowerCase()
      
      .replace(/\bđh\b/g, 'đại học')
      .replace(/\bđntu\b/g, 'đại học nông lâm')
      .replace(/\bđhql\b/g, 'đại học quốc gia')
      .replace(/\btp\.?\s*hcm\b/g, 'thành phố hồ chí minh')
      .replace(/\bhcm\b/g, 'hồ chí minh')
      .replace(/\bq\.\s*/g, 'quận ')
      .replace(/\bp\.\s*/g, 'phường ')
      .replace(/\bkhu\b/g, '')
      .replace(/\bcampus\b/g, '')
      
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  
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

  
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
  }

  
  private deduplicatePois(allPois: PointOfInterest[]): PointOfInterest[] {
    
    const sorted = [...allPois].sort((a, b) => {
      const score = (p: PointOfInterest) => (p.verified ? 2 : 0) + (p.status === 'approved' ? 1 : 0);
      return score(b) - score(a);
    });

    
    const CELL_SIZE = 0.01;
    const grid: Map<string, PointOfInterest[]> = new Map();
    const unique: PointOfInterest[] = [];

    const cellKey = (lat: number, lng: number) =>
      `${Math.floor(lat / CELL_SIZE)},${Math.floor(lng / CELL_SIZE)}`;

    for (const poi of sorted) {
      const key = cellKey(poi.lat, poi.lng);
      const latBase = parseInt(key.split(',')[0]);
      const lngBase = parseInt(key.split(',')[1]);

      
      const candidates: PointOfInterest[] = [];
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLng = -1; dLng <= 1; dLng++) {
          const adjKey = `${latBase + dLat},${lngBase + dLng}`;
          const cell = grid.get(adjKey);
          if (cell) candidates.push(...cell);
        }
      }

      const isDup = candidates.some(ex => {
        
        
        
        
        
        
        
        const normEx = this.normalizePoiName(ex.name);
        const normPoi = this.normalizePoiName(poi.name);
        if (normEx && normPoi && normEx === normPoi) return true; 
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
    const key = `all:${bounds ? `${bounds.minLat},${bounds.maxLat},${bounds.minLng},${bounds.maxLng}` : 'none'}`;
    const now = Date.now();
    const cached = this._poiCache.get(key);
    if (cached && cached.expires > now) {
      return cached.data;
    }
    if (cached) this._poiCache.delete(key);

    
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPoints(bounds),
      this.fetchLocations(bounds)
    ]);

    
    
    
    
    const allPois = [...mapPoints, ...locations];
    const result = this.mergeDuplicateIds(this.deduplicatePois(allPois));

    
    if (this._poiCache.size >= MapService.POI_CACHE_MAX) {
      const oldestKey = this._poiCache.keys().next().value;
      if (oldestKey) this._poiCache.delete(oldestKey);
    }
    this._poiCache.set(key, { data: result, expires: now + MapService.POI_CACHE_TTL_MS });
    return result;
  }


  private async fetchMapPoints(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    const typesMap: { [key: number]: string } = { 1: 'university', 2: 'school', 3: 'library', 4: 'bookstore', 5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe', 9: 'restaurant', 10: 'market', 11: 'convenience' };

    

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
    const key = `cat:${category.toLowerCase()}:${bounds ? `${bounds.minLat},${bounds.maxLat},${bounds.minLng},${bounds.maxLng}` : 'none'}`;
    const now = Date.now();
    const cached = this._poiCache.get(key);
    if (cached && cached.expires > now) {
      return cached.data;
    }
    if (cached) this._poiCache.delete(key);

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
    
    
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPointsByCategory(typeId, catLower, bounds),
      this.fetchLocationsByCategory(catLower, bounds)
    ]);
    
    
    const allPois = [...mapPoints, ...locations];
    const result = this.deduplicatePois(allPois);

    if (this._poiCache.size >= MapService.POI_CACHE_MAX) {
      const oldestKey = this._poiCache.keys().next().value;
      if (oldestKey) this._poiCache.delete(oldestKey);
    }
    this._poiCache.set(key, { data: result, expires: now + MapService.POI_CACHE_TTL_MS });
    return result;
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

  
  private filterInBounds(pois: PointOfInterest[], bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): PointOfInterest[] {
    return pois.filter(p => p.lat >= bounds.minLat && p.lat <= bounds.maxLat && p.lng >= bounds.minLng && p.lng <= bounds.maxLng);
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
      
      this.logger.warn(`Auto-embed POI failed (non-fatal): ${e}`);
    }
    this._poiCache.clear();
    return this.mapPointToPoi(saved)!;
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    
    
    
    
    
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

      
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, {
            city: query,
            points: pointsData,
            context: context
          }, { timeout: 45000 })
        );
        const payload = response.data;
        
        
        
        
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

  
  private static readonly CLIMATE_RISK_CACHE_TTL_MS = 24 * 3600 * 1000;
  private static readonly CLIMATE_RISK_CACHE_MAX = 60;
  private readonly _climateRiskCache = new Map<string, { data: any; expires: number }>();

  
  async getClimateRisk(params: {
    minLat?: number; maxLat?: number; minLng?: number; maxLng?: number;
    lat?: number; lng?: number; radiusKm?: number; date?: string;
  }): Promise<any> {
    
    let key: string;
    if (params.minLat !== undefined && params.maxLat !== undefined &&
        params.minLng !== undefined && params.maxLng !== undefined) {
      key = `climate:${params.minLat}:${params.maxLat}:${params.minLng}:${params.maxLng}:${params.date || ''}`;
    } else {
      key = `climate:${params.lat}:${params.lng}:${params.radiusKm}:${params.date || ''}`;
    }
    const now = Date.now();

    const cached = this._climateRiskCache.get(key);
    if (cached && cached.expires > now) {
      this.logger.log(`climate-risk cache hit: ${key}`);
      return { ...cached.data, cached: true };
    }
    if (cached) this._climateRiskCache.delete(key);

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/climate/risk`, {
          min_lat: params.minLat,
          max_lat: params.maxLat,
          min_lng: params.minLng,
          max_lng: params.maxLng,
          lat: params.lat,
          lng: params.lng,
          radius_km: params.radiusKm ?? 15,
          date: params.date || null,
        }, { timeout: 30000 })
      );
      const result = response.data || {};

      if (this._climateRiskCache.size >= MapService.CLIMATE_RISK_CACHE_MAX) {
        const oldestKey = this._climateRiskCache.keys().next().value;
        if (oldestKey) this._climateRiskCache.delete(oldestKey);
      }
      this._climateRiskCache.set(key, { data: result, expires: now + MapService.CLIMATE_RISK_CACHE_TTL_MS });

      return result;
    } catch (error: any) {
      this.logger.error(`AI climate-risk unavailable: ${error.message}`);
      return {
        type: 'FeatureCollection',
        features: [],
        heat_points: [],
        risk_ranking: [],
        risk_weights: { flood_risk: 0.35, weather_risk: 0.35, access_risk: 0.30 },
        metadata: {
          method: 'climate_guardian_v1',
          degraded: true,
          reason: 'Dịch vụ AI Bảo Vệ Khí Hậu tạm thời không khả dụng.',
          data_source: 'none',
          last_updated: new Date().toISOString(),
        },
      };
    }
  }

  
  async getClimateAlternatives(params: {
    lat: number; lng: number;
    minLat?: number; maxLat?: number; minLng?: number; maxLng?: number;
    radiusKm?: number; category?: string;
  }): Promise<any> {
    const key = `climate-alt:${params.lat}:${params.lng}:${params.radiusKm || 10}:${params.category || ''}`;
    const now = Date.now();

    const cached = this._climateRiskCache.get(key);
    if (cached && cached.expires > now) {
      this.logger.log(`climate-alternatives cache hit: ${key}`);
      return { ...cached.data, cached: true };
    }
    if (cached) this._climateRiskCache.delete(key);

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/climate/alternatives`, {
          lat: params.lat,
          lng: params.lng,
          min_lat: params.minLat,
          max_lat: params.maxLat,
          min_lng: params.minLng,
          max_lng: params.maxLng,
          radius_km: params.radiusKm ?? 10,
          category: params.category || null,
        }, { timeout: 30000 })
      );
      const result = response.data || {};

      if (this._climateRiskCache.size >= MapService.CLIMATE_RISK_CACHE_MAX) {
        const oldestKey = this._climateRiskCache.keys().next().value;
        if (oldestKey) this._climateRiskCache.delete(oldestKey);
      }
      this._climateRiskCache.set(key, { data: result, expires: now + MapService.CLIMATE_RISK_CACHE_TTL_MS });

      return result;
    } catch (error: any) {
      this.logger.error(`AI climate-alternatives unavailable: ${error.message}`);
      return {
        type: 'FeatureCollection',
        features: [],
        nearest_safe: null,
        nearest_unsafe: null,
        safe_count: 0,
        unsafe_count: 0,
        total_nearby: 0,
        metadata: {
          method: 'climate_guardian_alternatives_v1',
          degraded: true,
          reason: 'Dịch vụ AI Bảo Vệ Khí Hậu tạm thời không khả dụng.',
          center_lat: params.lat,
          center_lng: params.lng,
          last_updated: new Date().toISOString(),
        },
      };
    }
  }

  
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

    
    const cacheKey = `data-gaps:${gridSizeKm}:${topN}:${JSON.stringify(bounds || {})}:${JSON.stringify(categories || [])}`;

    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Data gaps cache hit: ${cacheKey}`);
      return cached.data;
    }

    
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

    
    let points = pois.map((p) => ({
      ...p,
      lat: p.lat,
      lng: p.lng,
    }));
    if (categories && categories.length > 0) {
      const catsLower = categories.map((c) => c.toLowerCase().trim());
      points = points.filter((p) => catsLower.includes(String(p.category || '').toLowerCase()));
    }

    
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

    
    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }

    return result;
  }

  
  
  async getSurveyPriorities(params: {
    current_lat?: number; current_lng?: number;
    min_lat?: number; max_lat?: number; min_lng?: number; max_lng?: number;
    grid_size_km?: number; top_n?: number;
    survey_time_hours?: number; surveyor_speed_kmh?: number;
    influence_radius_km?: number; spatial_weight?: number;
  }): Promise<any> {
    const centerLat = params.current_lat ? Number(params.current_lat) : 10.9567;
    const centerLng = params.current_lng ? Number(params.current_lng) : 107.1825;
    const gridSizeKm = params.grid_size_km ? Number(params.grid_size_km) : 1.0;
    const topN = params.top_n ? Math.max(1, Math.min(50, parseInt(String(params.top_n), 10))) : 15;
    const surveyTime = params.survey_time_hours ? Number(params.survey_time_hours) : 1.0;
    const speedKmh = params.surveyor_speed_kmh ? Number(params.surveyor_speed_kmh) : 30.0;
    const influenceKm = params.influence_radius_km ? Number(params.influence_radius_km) : 2.0;
    const spatialW = params.spatial_weight !== undefined ? Number(params.spatial_weight) : 0.25;

    
    let minLat: number, maxLat: number, minLng: number, maxLng: number;
    if (params.min_lat != null && params.max_lat != null && params.min_lng != null && params.max_lng != null) {
      minLat = Number(params.min_lat); maxLat = Number(params.max_lat);
      minLng = Number(params.min_lng); maxLng = Number(params.max_lng);
    } else {
      const span = 0.05; 
      minLat = centerLat - span; maxLat = centerLat + span;
      minLng = centerLng - span; maxLng = centerLng + span;
    }

    
    const cacheKey = `survey:prior:${minLat.toFixed(5)}:${maxLat.toFixed(5)}:${minLng.toFixed(5)}:${maxLng.toFixed(5)}:${centerLat.toFixed(5)}:${centerLng.toFixed(5)}:${gridSizeKm}:${topN}:${surveyTime}:${speedKmh}:${influenceKm}:${spatialW}`;
    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Survey priorities cache hit: ${cacheKey}`);
      const cachedValue = cached.data;
      return {
        ...cachedValue,
        metadata: { ...((cachedValue && cachedValue.metadata) || {}), cached: true },
      };
    }

    
    let pois: PointOfInterest[] = [];
    try {
      pois = await this.findAllPois({ minLat, maxLat, minLng, maxLng });
    } catch (dbErr: any) {
      this.logger.warn(`DB fetch for survey priorities failed: ${dbErr.message}`);
    }

    const points = pois.map((p) => ({
      lat: p.lat, lng: p.lng, name: p.name,
      category: p.category, address: p.address || '',
      description: p.description || '',
    }));

    
    let result: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/survey/priorities`, {
          points,
          current_location: { lat: centerLat, lng: centerLng },
          bbox: { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng },
          grid_size_km: gridSizeKm,
          top_n: topN,
          survey_time_hours: surveyTime,
          surveyor_speed_kmh: speedKmh,
          influence_radius_km: influenceKm,
          spatial_weight: spatialW,
        }, { timeout: 30000 })
      );
      result = response.data || {};
    } catch (aiError: any) {
      const detail = aiError?.response?.data?.detail || aiError.message || 'AI service unavailable';
      this.logger.error(`AI survey priorities failed: ${detail}`);
      result = {
        type: 'FeatureCollection',
        features: [],
        next_point: null,
        summary: {
          total_cells: 0, evaluated_cells: 0, considered: 0,
          grid_size_km: gridSizeKm, poi_count: points.length, points_used: points.length,
          current_location: { lat: centerLat, lng: centerLng },
          bbox: { min_lat: minLat, max_lat: maxLat, min_lng: minLng, max_lng: maxLng },
          top_n: topN, max_results: topN,
        },
        metadata: {
          method: 'entropy_infovalue_cost_v1',
          degraded: true,
          reason: `Dịch vụ AI lên kế hoạch khảo sát tạm thời không khả dụng: ${detail}`,
        },
      };
    }

    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }
    return result;
  }

  
  async getSurveyNext(params: {
    current_lat?: number; current_lng?: number;
    min_lat?: number; max_lat?: number; min_lng?: number; max_lng?: number;
    grid_size_km?: number; top_n?: number;
    survey_time_hours?: number; surveyor_speed_kmh?: number;
    influence_radius_km?: number; spatial_weight?: number;
  }): Promise<any> {
    const centerLat = params.current_lat ? Number(params.current_lat) : 10.9567;
    const centerLng = params.current_lng ? Number(params.current_lng) : 107.1825;
    const gridSizeKm = params.grid_size_km ? Number(params.grid_size_km) : 1.0;
    const topN = params.top_n ? Math.max(1, Math.min(50, parseInt(String(params.top_n), 10))) : 15;
    const cacheKey = `survey:next:${centerLat.toFixed(5)}:${centerLng.toFixed(5)}:${gridSizeKm}:${topN}:${params.survey_time_hours}:${params.surveyor_speed_kmh}:${params.influence_radius_km}:${params.spatial_weight}`;
    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Survey next cache hit: ${cacheKey}`);
      const cachedValue = cached.data;
      return {
        ...cachedValue,
        metadata: { ...((cachedValue && cachedValue.metadata) || {}), cached: true },
      };
    }

    
    const priorities = await this.getSurveyPriorities(params);
    const nextPoint = priorities.next_point || null;
    const feature = priorities.features?.[0] || null;
    const result = { feature, next_point: nextPoint, metadata: priorities.metadata };

    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }
    return result;
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

  
  async getFeaturedPins(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<FeaturedPin[]> {
    try {
      const pins: FeaturedPin[] = [];

      
      
      
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

      
      const greenLabs = await this.mapPointRepo.query(
        'SELECT id, title as name, description, lat, lng, address FROM green_challenges WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'active\' LIMIT 5000'
      );
      for (const r of greenLabs) {
        const lat = Number(r.lat), lng = Number(r.lng);
        if (!this.isValidLatLng(lat, lng)) continue;
        pins.push({
          id: `green-${r.id}`, name: r.name, category: 'green',
          lat, lng, description: r.description || '', address: r.address || '',
          featureLink: FEATURE_LINK_MAP.green,
        });
      }

      
      const summerLabs = await this.mapPointRepo.query(
        'SELECT id, name, description, location as address, lat, lng FROM summer_campaigns WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5000'
      );
      for (const r of summerLabs) {
        const lat = Number(r.lat), lng = Number(r.lng);
        if (!this.isValidLatLng(lat, lng)) continue;
        pins.push({
          id: `summer-${r.id}`, name: r.name, category: 'summer',
          lat, lng, description: r.description || '', address: r.address || r.name,
          featureLink: FEATURE_LINK_MAP.summer,
        });
      }

      
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

      
      const marketLabs = await this.mapPointRepo.query(
        'SELECT id, name, description, category, lat, lng, address FROM shared_items WHERE lat IS NOT NULL AND lng IS NOT NULL AND status = \'available\' LIMIT 5000'
      );
      for (const r of marketLabs) {
        const lat = Number(r.lat), lng = Number(r.lng);
        if (!this.isValidLatLng(lat, lng)) continue;
        const desc = r.category ? `${r.category} · ${r.description || ''}` : r.description || '';
        pins.push({
          id: `market-${r.id}`, name: r.name, category: 'market',
          lat, lng, description: desc, address: r.address || '',
          featureLink: FEATURE_LINK_MAP.market,
        });
      }
    



      return pins;
    } catch (error: any) {
      this.logger.error(`Error getting featured pins: ${error.message}`);
      return [];
    }
  }

  
  private isInBounds(lat: number, lng: number, bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }): boolean {
    return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
  }

  
  

  
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

    
    const cacheKey = `resource-opt:${budget}:${radius ?? 'auto'}:${centerLat}:${centerLng}:${regionRadius}`;

    
    const now = Date.now();
    const cached = this._resourceOptCache.get(cacheKey);
    if (cached && now < cached.expires) {
      this.logger.debug(`Resource optimization cache hit: ${cacheKey}`);
      return cached.data;
    }

    
    let pois: PointOfInterest[] = [];
    try {
      pois = await this.findAllPois();
    } catch (dbErr: any) {
      this.logger.warn(`DB fetch for resource optimization failed: ${dbErr.message}`);
    }

    
    const demandPoints = pois.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      address: p.address || '',
      weight: Math.max(10, (p.rating_avg || 3) * 20),
    }));

    
    
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

    
    this._resourceOptCache.set(cacheKey, { data: result, expires: now + MapService.RESOURCE_OPT_CACHE_TTL_MS });

    
    if (this._resourceOptCache.size > MapService.RESOURCE_OPT_CACHE_MAX) {
      const oldestKey = this._resourceOptCache.keys().next().value;
      if (oldestKey) this._resourceOptCache.delete(oldestKey);
    }

    return result;
  }

  
  
  

  
  async nLSearch(query: string, limit: number = 20): Promise<any> {
    
    let parsedQuery: any = null;
    let explanation = '';
    let degraded = false;
    
    
    let intentResult: any = { intent: 'geo_recommend', confidence: 0 };

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
      
      if (payload.intent && payload.intent.intent) {
        intentResult = payload.intent;
      }
    } catch (aiError: any) {
      this.logger.warn(
        `AI service unavailable for nl-search, using keyword fallback: ${aiError.message}`
      );
      parsedQuery = this._fallbackParse(query);
      explanation = `Tìm kiếm: "${query}"`;
      degraded = true;
      
      
      intentResult = this._classifyIntentFallback(parsedQuery, query);
    }

    
    let pois: PointOfInterest[] = [];
    try {
      const facilityTypes: string[] = parsedQuery?.facility_types || [];
      const allPois =
        facilityTypes.length > 0
          ? await this._findPoisByCategories(facilityTypes)
          : await this.findAllPois();

      
      const conditions: string[] = parsedQuery?.conditions || [];
      pois = this._filterByConditions(allPois, conditions);

      
      pois = this.deduplicatePois(pois);
      pois.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
      pois = pois.slice(0, limit);
    } catch (dbError: any) {
      this.logger.error(`Error querying POIs for nl-search: ${dbError.message}`);
    }

    
    return {
      query,
      parsed_query: parsedQuery,
      explanation,
      degraded,
      results: pois,
      total: pois.length,
      
      
      intent: intentResult,
    };
  }

  
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

  
  private _classifyIntentFallback(parsed: Record<string, any>, text: string): Record<string, any> {
    const raw = text.toLowerCase().trim();

    
    const reportKw = ['hỏng', 'đứt', 'lỗi', 'ngập', 'gửi báo cáo', 'báo cáo',
      'báo cáo sự cố', 'báo lỗi', 'báo wifi', 'mạng yếu', 'không hoạt động',
      'không kết nối', 'đóng góp thông tin'];
    if (reportKw.some((kw) => raw.includes(kw))) {
      return { intent: 'report_form', confidence: 0.8, detail: 'Có từ khóa báo cáo' };
    }

    
    const findVerbs = ['tìm', 'tìm kiếm', 'tìm nơi', 'tìm đường'];
    if (findVerbs.some((v) => raw.includes(v))) {
      return { intent: 'geo_recommend', confidence: 0.7, detail: 'Có động từ tìm' };
    }

    
    const questionWords = ['ở đâu', 'là gì', 'thế nào', 'bao nhiêu', 'giờ mở cửa', 'giờ đóng cửa'];
    if (questionWords.some((qw) => raw.includes(qw))) {
      return { intent: 'geo_query', confidence: 0.7, detail: 'Câu hỏi thông tin địa lý' };
    }

    
    return { intent: 'geo_recommend', confidence: 0.3, detail: 'Mặc định tìm gợi ý' };
  }

  
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
        
      }

      return true;
    });
  }
}
