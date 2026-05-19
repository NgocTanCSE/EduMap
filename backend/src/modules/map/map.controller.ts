import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MapService } from './map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('MOD-MAP: Bản đồ giáo dục thông minh')
@Controller('api/map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('points')
  @ApiOperation({ summary: 'F-01: Lấy các điểm bản đồ đã phê duyệt' })
  async getPoints() {
    const points = await this.mapService.getPoints();
    return { points };
  }

  @Get('search')
  @ApiOperation({ summary: 'F-02: Tìm kiếm trên map hoặc tìm theo bán kính (ST_DWithin)' })
  async search(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    if (lat && lng) {
      return this.mapService.findNearby(
        Number(lat),
        Number(lng),
        radius ? Number(radius) : undefined,
      );
    }
    return this.mapService.searchPoints(q, type);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'F-03: Dữ liệu phân bố bản đồ nhiệt (Heatmap)' })
  async getHeatmap() {
    return this.mapService.getHeatmapData();
  }

  @Post('points')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-04: Đóng góp điểm giáo dục mới (Crowdsourcing)' })
  async createPoint(@Body() body: any) {
    return this.mapService.createPoint(body);
  }

  @Put('points/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt/từ chối điểm bản đồ crowdsource' })
  async approvePoint(
    @Param('id') id: string,
    @Body('status') status: 'approved' | 'rejected',
  ) {
    return this.mapService.approvePoint(id, status);
  }
}
