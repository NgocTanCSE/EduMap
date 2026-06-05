import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LearningCommunityService } from './learning-community.service';

@ApiTags('MOD-LEARN: Bản đồ nhóm học tập & Tự học (Community Learning Map)')
@Controller('learning-spots')
export class LearningCommunityController {
  constructor(private readonly learnService: LearningCommunityService) {}

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

  @Post()
  @ApiOperation({ summary: 'Đăng ký một địa điểm học tập mới (Café học bài, Thư viện,...) kèm GPS' })
  async create(@Body() body: any) {
    return this.spotRepoCreate(body);
  }

  private async spotRepoCreate(body: any) {
    return this.learnService.createSpot(body);
  }
}
