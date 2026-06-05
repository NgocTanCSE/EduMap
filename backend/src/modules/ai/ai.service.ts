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
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://ai-service:8000';
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

  /**
   * Dự đoán lộ trình nghề nghiệp dựa trên thông tin người dùng
   */
  async predictCareerPath(userData: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/predict`, userData)
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error calling AI Predict API: ${error.message}`);
      throw new HttpException(
        'Dịch vụ tư vấn AI đang tạm thời gián đoạn.',
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
      return { status: 'offline', analysis: 'Dữ liệu xu hướng thị trường chưa sẵn sàng.' };
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
      // Fallback response
      return { 
          motivation_message: "Hãy bắt đầu một ngày mới đầy năng lượng!", 
          suggested_action: "Xem qua các khóa học hoặc công việc mới nhất." 
      };
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
      // Fail-safe: Accept but flag for review
      return { 
        is_safe: false, 
        action_taken: "SEND_TO_HUMAN_REVIEW",
        flags: ["AI Service Unavailable"] 
      };
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
      return { 
        is_eligible: false, 
        message: 'Dịch vụ phân tích hồ sơ AI đang bận. Vui lòng thử lại sau.' 
      };
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
          message: message, 
          history: history,
          context: systemContext 
        })
      );

      const aiReply = response.data.message;

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
      return { 
        message: 'AI Chatbot đang bận hoặc gặp sự cố kết nối, vui lòng thử lại sau ít phút.',
        error: true
      };
    }
  }
}
