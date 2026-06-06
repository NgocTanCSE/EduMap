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
      category: p.type,
      lat,
      lng,
    };
  }

  async findAllPois(): Promise<PointOfInterest[]> {
    const points = await this.mapPointRepo.find();
    return points.map(p => this.mapPointToPoi(p));
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    const points = await this.mapPointRepo.find();
    return points.map(p => this.mapPointToPoi(p)).filter(poi => poi.category.toLowerCase() === category.toLowerCase());
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    try {
      // In a real application, this would call an external AI service or the internal AI module
      // Defensive programming: Always return a safe fallback if AI fails or is not implemented yet
      console.log(`Mock AI Analysis for query: "${query}"`);
      
      const allPois = await this.findAllPois();
      return {
        query,
        analysis: "Dựa trên phân tích giả lập, các địa điểm phù hợp với yêu cầu của bạn tập trung ở khu vực trung tâm.",
        recommended_pois: allPois.slice(0, 2),
        confidence_score: 0.85
      };
    } catch (error) {
      console.error('Error during AI map analysis:', error);
      throw new Error('AI analysis failed. Please try again later.');
    }
  }
}
