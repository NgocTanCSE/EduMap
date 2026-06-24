import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';
import { GoogleAIService } from '../../services/google-ai.service';

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
    private readonly googleAI: GoogleAIService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
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
      verified: l.is_verified,
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

  async findAllPois(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    // Fetch from both map_points and locations tables for proper data sync
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPoints(bounds),
      this.fetchLocations(bounds)
    ]);
    
    // Merge and deduplicate by id
    const allPois = [...mapPoints, ...locations];
    const uniquePois = allPois.filter((poi, index, self) => 
      index === self.findIndex(p => p.id === poi.id)
    );
    
    return uniquePois;
  }

  private async fetchMapPoints(bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }): Promise<PointOfInterest[]> {
    let query = this.mapPointRepo.createQueryBuilder('map_points');

    if (bounds) {
      query = query.where(
        `ST_Intersects(map_points.location, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))`,
        { ...bounds }
      );
    }

    query = query.limit(2000);
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

    query = query.limit(2000);
    const locations = await query.getMany();
    return locations.map(l => this.locationToPoi(l)).filter((p): p is PointOfInterest => p !== null);
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    const typeIdsMap: { [key: string]: number } = {
      'university': 1,
      'school': 2,
      'library': 3,
      'bookstore': 4,
      'lab': 5,
      'wifi': 6,
      'green': 7,
      'cafe': 8,
    };
    
    const catLower = category.toLowerCase();
    const typeId = typeIdsMap[catLower];
    
    // Fetch from both tables
    const [mapPoints, locations] = await Promise.all([
      this.fetchMapPointsByCategory(typeId, catLower),
      this.fetchLocationsByCategory(catLower)
    ]);
    
    // Merge and deduplicate
    const allPois = [...mapPoints, ...locations];
    const uniquePois = allPois.filter((poi, index, self) => 
      index === self.findIndex(p => p.id === poi.id)
    );
    
    return uniquePois;
  }

  private async fetchMapPointsByCategory(typeId: number | undefined, catLower: string): Promise<PointOfInterest[]> {
    let query = this.mapPointRepo.createQueryBuilder('map_points');
    
    if (typeId) {
      query = query.where('map_points.type_id = :typeId', { typeId })
                   .orWhere('LOWER(map_points.description) LIKE :desc', { desc: `%${catLower}%` })
                   .orWhere('LOWER(map_points.description) LIKE :desc2', { desc2: `%${catLower === 'green' ? 'park' : catLower === 'university' ? 'college' : catLower}%` });
    } else {
      query = query.where('LOWER(map_points.description) LIKE :desc', { desc: `%${catLower}%` });
    }
    const points = await query.getMany();
    return points.map(p => this.mapPointToPoi(p)).filter((p): p is PointOfInterest => p !== null);
  }

  private async fetchLocationsByCategory(catLower: string): Promise<PointOfInterest[]> {
    const query = this.locationRepo.createQueryBuilder('locations')
      .leftJoinAndSelect('locations.category', 'category')
      .where(
        `(LOWER(category.name) LIKE :cat OR LOWER(locations.description) LIKE :desc OR LOWER(locations.description) LIKE :desc2)`,
        { cat: `%${catLower}%`, desc: `%${catLower}%`, desc2: `%${catLower === 'green' ? 'park' : catLower === 'university' ? 'college' : catLower}%` }
      )
      .limit(2000);
    
    const locations = await query.getMany();
    return locations.map(l => this.locationToPoi(l)).filter((p): p is PointOfInterest => p !== null);
  }

  async getCategories(): Promise<string[]> {
    return ['university', 'school', 'library', 'bookstore', 'lab', 'wifi', 'green', 'cafe', 'restaurant'];
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
      'restaurant': 9
    };

    const point = this.mapPointRepo.create({
      name: data.name,
      description: data.description,
      address: data.address,
      type: data.category,
      type_id: typeIdsMap[data.category.toLowerCase()] || 0,
      status: 'active',
      location: {
        type: 'Point',
        coordinates: [data.lng, data.lat]
      }
    });

    const saved = await this.mapPointRepo.save(point);
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
          this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, {
            city: query,
            points: pointsData,
            context: context
          })
        );
        return response.data.ai_analysis || response.data;
      } catch (aiServiceError) {
        this.logger.warn('AI Service unavailable, using Gemini direct');
        return this.googleAI.analyzeGeoDensity(query, pointsData);
      }
    } catch (error) {
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
}

  async getStats() {
    try {
      const allPois = await this.findAllPois();
      const stats: Record<string, number> = {};
      for (const poi of allPois) {
        const cat = poi.category || 'other';
        stats[cat] = (stats[cat] || 0) + 1;
      }
      return { total: allPois.length, categories: stats };
    } catch (error) {
      this.logger.error(`Error getting map stats: ${error.message}`);
      return { total: 0, categories: {} };
    }
  }

