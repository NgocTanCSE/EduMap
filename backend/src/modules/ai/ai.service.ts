import { Injectable, ForbiddenException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AIService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Gui tin nhan den Chatbot AI
   */
  async chat(message: string, context: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post('/api/ai/chat', { message, context })
      );
      return response.data;
    } catch (error) {
      return { message: 'AI Chatbot đang bận, vui lòng thử lại sau.' };
    }
  }

  /**
   * Lay lo trinh hoc tap ca nhan hoa
   */
  async getLearningPath(userId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`/api/ai/learning-path/${userId}`)
      );
      return response.data;
    } catch (error) {
      return { message: 'Không thể tải lộ trình học lúc này.' };
    }
  }

  /**
   * Phan tich ket qua trac nghiem huong nghiep
   */
  async processCareerQuiz(userId: string, answers: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post('/api/ai/career-quiz', { user_id: userId, answers })
      );
      return response.data;
    } catch (error) {
      throw new ForbiddenException('Không thể phân tích kết quả trắc nghiệm.');
    }
  }
}
