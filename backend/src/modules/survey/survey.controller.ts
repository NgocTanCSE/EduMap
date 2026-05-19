import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SurveyService } from './survey.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-SURVEY: Khảo sát & Ý kiến')
@Controller('api/surveys')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả các cuộc khảo sát đang hoạt động' })
  async getSurveys() {
    return this.surveyService.getSurveys();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo cuộc khảo sát mới' })
  async create(@Request() req: any, @Body() data: any) {
    return this.surveyService.createSurvey(req.user.id, data);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp câu trả lời khảo sát đóng góp ý kiến' })
  async submit(
    @Request() req: any,
    @Param('id') id: string,
    @Body('answers') answers: any,
  ) {
    return this.surveyService.submitResponse(id, req.user.id, answers);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem phân tích dữ liệu và báo cáo kết quả khảo sát trực quan' })
  async getAnalytics(@Param('id') id: string) {
    return this.surveyService.analyzeSurvey(id);
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xuất dữ liệu câu trả lời khảo sát (Excel/CSV)' })
  async export(
    @Param('id') id: string,
    @Query('format') format?: string,
  ) {
    return this.surveyService.exportData(id, format || 'csv');
  }
}
