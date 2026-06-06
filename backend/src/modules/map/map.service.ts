import { Injectable } from '@nestjs/common';

export interface PointOfInterest {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

@Injectable()
export class MapService {
  private pois: PointOfInterest[] = []; // In-memory mock data

  constructor() {
    this.pois.push({ id: 'poi1', name: 'University A', category: 'Education', lat: 10.762622, lng: 106.660172 });
    this.pois.push({ id: 'poi2', name: 'Library B', category: 'Education', lat: 10.778891, lng: 106.699990 });
    this.pois.push({ id: 'poi3', name: 'Park C', category: 'Recreation', lat: 10.789123, lng: 106.700123 });
  }

  async findAllPois(): Promise<PointOfInterest[]> {
    // In a real app, this would fetch data from a database, possibly with spatial queries
    return this.pois;
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    return this.pois.filter(poi => poi.category.toLowerCase() === category.toLowerCase());
  }

  async analyzeWithAI(query: string, context?: any): Promise<any> {
    try {
      // In a real application, this would call an external AI service or the internal AI module
      // Defensive programming: Always return a safe fallback if AI fails or is not implemented yet
      console.log(`Mock AI Analysis for query: "${query}"`);
      
      return {
        query,
        analysis: "Dựa trên phân tích giả lập, các địa điểm phù hợp với yêu cầu của bạn tập trung ở khu vực trung tâm.",
        recommended_pois: this.pois.slice(0, 2),
        confidence_score: 0.85
      };
    } catch (error) {
      console.error('Error during AI map analysis:', error);
      throw new Error('AI analysis failed. Please try again later.');
    }
  }
}
