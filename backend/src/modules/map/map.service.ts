import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MapPoint } from './entities/map-point.entity';

export interface PointOfInterest {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);
  private readonly aiServiceUrl: string;

  constructor(
    @InjectRepository(MapPoint)
    private readonly mapPointRepo: Repository<MapPoint>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
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
    };
  }

  async findAllPois(): Promise<PointOfInterest[]> {
    // Trả về toàn bộ dữ liệu. Giao diện (Next.js) sẽ dùng Supercluster chunkedLoading để xử lý hiển thị.
    const points = await this.mapPointRepo.find();
    return points.map(p => this.mapPointToPoi(p)).filter((p): p is PointOfInterest => p !== null);
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    // Tối ưu hóa Database Query: Filter dựa trên type_id OR description (vì crawled data lưu category vào description).
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

  async getCategories(): Promise<string[]> {
    return ['university', 'school', 'library', 'bookstore', 'lab', 'wifi', 'green', 'cafe', 'restaurant'];
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    try {
      this.logger.log(`Performing AI Analysis for query: "${query}"`);
      
      const allPois = await this.findAllPois();
      // Chuyển đổi dữ liệu sang format cho AI Service (khớp với GeoDensityAnalysisRequest)
      const pointsData = allPois.map(p => ({
        name: p.name,
        type: p.category, // AI Service expects 'type' instead of 'category'
        lat: p.lat,
        lng: p.lng
      }));

      // Sửa endpoint từ /geo/density thành /geo/analyze
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, {
          city: query,
          points: pointsData,
          context: context
        })
      );

      // AI Service returns { hubs: [], ai_analysis: { summary, density_score, recommendations } }
      const aiData = response.data.ai_analysis || response.data;
      return aiData;
    } catch (error) {
      this.logger.error(`Error during AI map analysis: ${error.message}`);
      // Fallback response nếu AI Service lỗi
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
