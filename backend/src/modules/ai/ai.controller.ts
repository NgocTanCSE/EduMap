import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Assistant')
@Controller('api/ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05: Chatbot AI (LLM + RAG)' })
  async chat(@Request() req: any, @Body('message') msg: string, @Body('context') ctx: any) {
    return this.aiService.chat(msg, ctx);
  }

  @Get('learning-path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-06: Lộ trình học cá nhân hóa' })
  async getLearningPath(@Request() req: any) {
    return this.aiService.getLearningPath(req.user.id);
  }

  @Post('career-quiz')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-08: Nộp bài trắc nghiệm hướng nghiệp' })
  async submitQuiz(@Request() req: any, @Body('answers') answers: any) {
    return this.aiService.processCareerQuiz(req.user.id, answers);
  }
}
