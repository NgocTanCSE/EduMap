import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Assistant')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) { }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05: Chatbot AI (LLM + RAG)' })
  async chat(
    @Request() req: any,
    @Body('message') msg: string, 
    @Body('history') history: any[],
    @Body('context') ctx: any
  ) {
    if (!msg || msg.trim().length === 0) {
      return { message: 'Tin nhắn không được để trống.' };
    }
    return this.aiService.chat(msg, history || [], ctx, req.user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử cuộc trò chuyện' })
  async getHistory(@Request() req: any) {
    return this.aiService.getUserHistory(req.user.id);
  }

  @Get('learning-path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-06: Lộ trình học cá nhân hóa' })
  async getLearningPath(@Request() req: any) {
    // Reusing the prediction logic for personalized path
    return this.aiService.predictCareerPath({ user_id: req.user.id, task: "learning_path" });
  }

  @Post('career-quiz')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-08: Nộp bài trắc nghiệm hướng nghiệp' })
  async submitQuiz(@Request() req: any, @Body('answers') answers: any) {
    return this.aiService.predictCareerPath({ user_id: req.user.id, answers, task: "career_quiz" });
  }

  @Get('trends')
  @ApiOperation({ summary: 'Phân tích xu hướng thị trường' })
  async getTrends() {
    return this.aiService.getMarketTrends();
  }

  @Get('analytics/stats')
  @ApiOperation({ summary: 'Thống kê AI Analytics' })
  async getAnalyticsStats() {
    return {
      success: true,
      data: {
        total_predictions: 1250,
        accuracy_rate: 0.92,
        active_models: 3
      }
    };
  }
}
