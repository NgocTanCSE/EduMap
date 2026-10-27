import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LearningCommunityService } from './learning-community.service';
import { LearningSpaceRecommenderService } from './learning-space-recommender.service';
import { AIService } from '../ai/ai.service';
import { RecommendSpotsDto } from './dto/recommend-spots.dto';

@ApiTags('MOD-LEARN: Bản đồ nhóm học tập & Tự học (Community Learning Map)')
@Controller('learning-spots')
export class LearningCommunityController {
  constructor(
    private readonly learnService: LearningCommunityService,
    private readonly recommenderService: LearningSpaceRecommenderService,
    private readonly aiService: AIService,
  ) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Tìm kiếm các địa điểm học tập lân cận bằng GPS (PostGIS)' })
  async getNearby(
    @Query('latitude') lat: number,
    @Query('longitude') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.learnService.getNearbySpots(Number(lat), Number(lng), radius ? Number(radius) : undefined);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Kiểm tra tình trạng chỗ trống thời gian thực của địa điểm học tập' })
  async getAvailability(@Param('id') id: string) {
    return this.learnService.checkAvailability(id);
  }

  @Get('recommend')
  @ApiOperation({
    summary: 'Gợi đề xuất địa điểm học tập theo vị trí + tiêu chí (scoring + AI explain)',
    description: 'Xếp hạng theo khoảng cách, giờ mở cửa, Wi-Fi, độ yên tĩnh, đánh giá. Giải thích từ AI service (cache 24h, fallback tĩnh). Degraded khi AI không khả dụng.',
  })
  async recommend(@Query() dto: RecommendSpotsDto) {
    return this.recommenderService.recommend(dto);
  }

  @Post('explain')
  @ApiOperation({ summary: 'Yêu cầu AI giải thích tại sao một địa điểm được đề xuất (single-spot explain)' })
  async explain(@Body() body: { spot: any; preferences?: any }) {
    const result = await this.aiService.explainLearningSpace(body.spot, body.preferences || {});
    // AIService returns null on failure; provide a template fallback.
    if (!result) {
      return {
        explanation: `${body.spot?.name || 'Địa điểm'} được đề xuất vì phù hợp với tiêu chí tìm kiếm của bạn. (Mẫu tĩnh — AI không khả dụng.)`,
        degraded: true,
        reason: 'AI service không khả dụng — sử dụng mẫu giải thích tĩnh.',
      };
    }
    return result;
  }

  @Post()
  @ApiOperation({ summary: 'Đăng ký một địa điệm học tập mới (Café học bài, Thư viện,...) kèm GPS' })
  async create(@Body() body: any) {
    return this.spotRepoCreate(body);
  }

  private async spotRepoCreate(body: any) {
    return this.learnService.createSpot(body);
  }
}
