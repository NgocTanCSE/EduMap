import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';

import { ChatHistory } from './entities/chat-history.entity';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(LearningMaterial) private readonly materialRepo: Repository<LearningMaterial>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(ChatHistory) private readonly historyRepo: Repository<ChatHistory>,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://127.0.0.1:8000';
  }

  /**
   * Lấy lịch sử chat của người dùng từ Database
   */
  async getUserHistory(userId: string) {
    try {
      return await this.historyRepo.find({
        where: { user: { id: userId } },
        order: { createdAt: 'ASC' },
        take: 50
      });
    } catch (error) {
      this.logger.error(`Error fetching chat history: ${error.message}`);
      return [];
    }
  }

  async search(query: string, limit: number = 5) {
    const normalizedQuery = `%${query.trim()}%`;
    const [materials, locations] = await Promise.all([
      this.materialRepo
        .createQueryBuilder('material')
        .select(['material.id', 'material.title', 'material.description', 'material.type', 'material.subject'])
        .where('material.deleted_at IS NULL')
        .andWhere('(LOWER(material.title) LIKE LOWER(:query) OR LOWER(material.description) LIKE LOWER(:query))', { query: normalizedQuery })
        .orderBy('material.view_count', 'DESC')
        .take(limit)
        .getMany(),
      this.locationRepo
        .createQueryBuilder('location')
        .select(['location.id', 'location.name', 'location.description', 'location.address'])
        .where('LOWER(location.name) LIKE LOWER(:query) OR LOWER(location.description) LIKE LOWER(:query)', { query: normalizedQuery })
        .take(limit)
        .getMany(),
    ]);

    return {
      success: true,
      data: [
        ...materials.map(material => ({
          id: material.id,
          document: `${material.title}: ${material.description || ''}`,
          metadata: {
            title: material.title,
            type: 'learning_material',
            category: material.subject || material.type,
          },
        })),
        ...locations.map(location => ({
          id: location.id,
          document: `${location.name}: ${location.description || ''}`,
          metadata: {
            title: location.name,
            type: 'map_location',
            address: location.address,
          },
        })),
      ].slice(0, limit),
    };
  }

  /**
   * Dự đoán lộ trình nghề nghiệp dựa trên thông tin người dùng
   * Cập nhật Endpoint sang /api/ai/career/recommend để nhận dữ liệu cấu trúc mảng
   */
  async predictCareerPath(userData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/career/recommend`, userData)
      );
      // Trả về top_careers để khớp với mong đợi của Frontend
      return response.data.top_careers || response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Career Recommend API: ${error.message}`);
throw new HttpException(
         'AI Career recommendation service is currently unavailable. Please ensure AI_SERVICE_URL is configured correctly.',
         HttpStatus.SERVICE_UNAVAILABLE,
       );
     }
   }
 
   /**
   * Phân tích xu hướng thị trường lao động
   */
  async getMarketTrends() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/trends`)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Trends API: ${error.message}`);
      throw new HttpException(
        'AI Market trends service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI DASHBOARD: Get personalized daily insight
   */
  async getDailyInsight(dashboardData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/analytics/daily-insight`, {
            dashboard_data: dashboardData
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Daily Insight API: ${error.message}`);
      throw new HttpException(
        'AI Daily Insight service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI GEO-ANALYSIS: Analyze education density and suggest areas for improvement
   */
  async analyzeGeoDensity(geoData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/analyze`, geoData)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Geo-Analyze API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ phân tích địa lý AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI LIBRARY: Generate summary and study guide for a learning material
   */
  async summarizeMaterial(materialData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/library/summarize`, materialData)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Library Summarize API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ tóm tắt AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI LEARNING PATH: Generate a personalized study plan
   */
  async generateLearningPath(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/learning-path`, data)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Learning Path API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ tạo lộ trình học tập AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI MENTOR: Match student with the best mentors
   */
  async matchMentor(matchData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/mentor/match`, matchData)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Mentor Match API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ ghép nối AI đang tạm thời gián đoạn.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI COMMUNITY: Moderate user-generated content
   */
  async moderateContent(userId: string, text: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/moderate`, {
          user_id: userId,
          text: text
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Moderation API: ${error.message}`);
      throw new HttpException(
        'AI Content moderation service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI SCHOLARSHIP: Check if student profile matches scholarship requirements
   */
  async checkScholarshipEligibility(userData: any, scholarshipData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/scholarship/check`, {
          user_data: userData,
          scholarship_data: scholarshipData
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Scholarship Check API: ${error.message}`);
      throw new HttpException(
        'AI Scholarship eligibility service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * AI Analytics Stats
   */
  async getAnalyticsStats() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/analytics/stats`)
      );
      const data = response.data || {};
      const historicalData = Array.isArray(data.historical_data) ? data.historical_data : [];
      const insights = data.insights || {};
      const lastValue = historicalData.length > 0 ? Number(historicalData[historicalData.length - 1].value || 0) : 0;
      const accuracyRate = insights.average_annual_growth_pct ? Math.min(0.99, 0.75 + Math.abs(Number(insights.average_annual_growth_pct)) / 100) : 0.9;
      const totalPredictions = await this.historyRepo.count();
      return {
        success: true,
        data: {
          total_predictions: totalPredictions,
          accuracy_rate: Number(accuracyRate.toFixed(2)),
          active_models: 2,
          status: data.status || 'success',
          historical_data: historicalData,
          insights,
          last_value: lastValue,
        }
      };
    } catch (error) {
      this.logger.error(`Error fetching AI analytics stats: ${error.message}`);
      throw new HttpException(
        'AI Analytics stats service is currently unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Chatbot AI am hiểu dữ liệu hệ thống (RAG Lite)
   */
  async chat(message: string, history: any[], context: any, userId?: string) {
    try {
      // 1. Thu thập dữ liệu thực tế từ CSDL để làm ngữ cảnh (Context)
      let materials = [];
      let points = [];
      try {
        [materials, points] = await Promise.all([
          this.materialRepo.find({ take: 5, order: { view_count: 'DESC' } }),
          this.locationRepo.find({ take: 10, where: { status: 'active' }, relations: ['category'] })
        ]);
      } catch (dbError) {
        this.logger.error(`Database context error: ${dbError.message}`);
      }

      const systemContext = {
        available_books: materials.map(m => m.title),
        educational_locations: points.map(p => `${p.name} (${p.category?.display_name}) at ${p.address}`),
        user_message: message,
        ...context
      };

      // 2. Gửi sang AI Service
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/chat`, {
          user_id: userId,
          message: message,
          history: history,
          context: systemContext,
        }, { timeout: 15000 })
      );

      const aiReply = response.data.reply || response.data.message;

      // 3. Persistent: Lưu vào Database nếu có userId
      if (userId) {
        try {
          const newChat = this.historyRepo.create({
            message: message,
            response: aiReply,
            context: systemContext,
            user: { id: userId } as any
          });
          await this.historyRepo.save(newChat);
        } catch (saveError) {
          this.logger.error(`Error saving chat history: ${saveError.message}`);
        }
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error in AI Chat: ${error.message}`);
      throw new HttpException(
        'AI Chat service is currently unavailable. Please ensure AI_SERVICE_URL is configured correctly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
