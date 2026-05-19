import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CareerService } from './career.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-CAREER: Lộ trình nghề nghiệp')
@Controller('api/careers')
export class CareerController {
  constructor(private readonly careerService: CareerService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các lộ trình nghề nghiệp trong hệ thống' })
  async getPaths(@Query('field') field?: string) {
    return this.careerService.getCareerPaths(field);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo lộ trình nghề nghiệp mới' })
  async createPath(@Body() data: any) {
    return this.careerService.createCareerPath(data);
  }

  @Get(':id/roadmap')
  @ApiOperation({ summary: 'Lấy cây lộ trình phát triển kỹ năng chi tiết của ngành nghề (Skill Roadmap)' })
  async getRoadmap(@Param('id') id: string) {
    return this.careerService.getSkillRoadmap(id);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gợi ý nghề nghiệp thông minh dựa trên kỹ năng và sở thích (AI Suggestions)' })
  async suggest(@Body('skills') skills: string[], @Body('interests') interests: string[]) {
    return this.careerService.suggestCareer(skills || [], interests || []);
  }
}
