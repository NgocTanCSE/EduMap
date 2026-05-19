import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class TrendService {
  constructor(
    private readonly httpService: HttpService,
    private readonly analyticsService: AnalyticsService
  ) {}

  /**
   * 📈 TRENDING: Lay xu huong ky nang tu AI Service
   */
  async getMarketTrends() {
    try {
      // AI Service se phan tich du lieu tuyen dung vung mien
      const response = await firstValueFrom(
        this.httpService.get('http://localhost:8000/api/ai/trends')
      );
      return response.data;
    } catch (error) {
      return { 
        top_skills: ['AI Engineering', 'Green Energy', 'Data Privacy'],
        growth_areas: ['Ho Chi Minh City', 'Da Nang'] 
      };
    }
  }

  /**
   * 🔮 PREDICT: Du bao lo trinh tiep theo cho mot User cu the
   */
  async predictNextStep(userId: string) {
    // 1. Lay top tu khoa nguoi dung nay hay tim kiem
    const topKeywords = await this.analyticsService.getTopKeywords();
    
    // 2. Gui sang AI Service de "doan" tuong lai
    try {
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:8000/api/ai/predict', {
          user_id: userId,
          recent_keywords: topKeywords
        })
      );
      return response.data;
    } catch (error) {
      return { recommendation: 'Ban nen tap trung vao nang cao ky nang Soft Skills.' };
    }
  }
}
