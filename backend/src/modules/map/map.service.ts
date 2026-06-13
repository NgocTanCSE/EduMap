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
