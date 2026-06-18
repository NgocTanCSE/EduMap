import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

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

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm AI theo tài liệu và địa điểm' })
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query || !query.trim()) {
      return { success: true, data: [] };
    }
    return this.aiService.search(query, limit ? parseInt(limit, 10) : 5);
  }

  @Post('learning-path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-06: Tạo lộ trình học cá nhân hóa bằng AI' })
  async getLearningPath(
    @Request() req: any,
    @Body('current_level') currentLevel: string,
    @Body('target_role') targetRole: string,
    @Body('time_commitment_hours_per_week') timeCommitment: number,
  ) {
    const data = {
      user_id: req.user.id,
      current_level: currentLevel || 'Beginner',
      target_role: targetRole || 'AI Developer',
      time_commitment_hours_per_week: timeCommitment || 10,
    };
    return this.aiService.generateLearningPath(data);
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
    return this.aiService.getAnalyticsStats();
  }
}
