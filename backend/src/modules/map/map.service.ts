import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(MapPoint)
    private readonly mapPointRepo: Repository<MapPoint>,
  ) {}

  private mapPointToPoi(p: MapPoint): PointOfInterest {
    let lat = 0;
    let lng = 0;
    if (p.location && p.location.type === 'Point' && Array.isArray(p.location.coordinates)) {
      lng = p.location.coordinates[0];
      lat = p.location.coordinates[1];
    }
    return {
      id: p.id,
      name: p.name,
      category: p.type || 'other',
      lat,
      lng,
    };
  }

  async findAllPois(): Promise<PointOfInterest[]> {
    // Trả về toàn bộ dữ liệu. Giao diện (Next.js) sẽ dùng Supercluster chunkedLoading để xử lý hiển thị.
    const points = await this.mapPointRepo.find();
    return points.map(p => this.mapPointToPoi(p));
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    // Tối ưu hóa Database Query: Filter dựa trên type_id.
    const typeIdsMap: { [key: string]: number } = {
      'school': 1,
      'library': 3,
      'lab': 5,
    };
    
    const typeId = typeIdsMap[category.toLowerCase()];
    
    let query = this.mapPointRepo.createQueryBuilder('map_points');
    if (typeId) {
        query = query.where('map_points.type_id = :typeId', { typeId });
    } else {
        query = query.where('1=0'); // No category match
    }
    const points = await query.getMany();
      
    return points.map(p => this.mapPointToPoi(p));
  }

  async getCategories(): Promise<string[]> {
    return ['school', 'library', 'lab'];
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    try {
      console.log(`Mock AI Analysis for query: "${query}"`);
      
      const allPois = await this.findAllPois();
      return {
        query,
        analysis: "Dựa trên phân tích, các địa điểm phù hợp với yêu cầu của bạn tập trung ở khu vực trung tâm.",
        recommended_pois: allPois.slice(0, 2),
        confidence_score: 0.85
      };
    } catch (error) {
      console.error('Error during AI map analysis:', error);
      throw new Error('AI analysis failed. Please try again later.');
    }
  }
}

