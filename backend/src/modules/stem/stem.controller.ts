import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StemService } from './stem.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-STEM: Sân chơi STEM')
@Controller('stem')
export class StemController {
  constructor(private readonly stemService: StemService) {}

  @Get('labs')
  @ApiOperation({ summary: 'Lấy danh sách tất cả các phòng LAB STEM' })
  async getLabs() {
    return this.stemService.getLabs();
  }

  @Get('labs/nearby')
  @ApiOperation({ summary: 'Tìm phòng LAB gần nhất qua GIS PostGIS' })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.stemService.getLabsNearby(Number(lat), Number(lng), radius ? Number(radius) : undefined);
  }

  @Post('labs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký phòng LAB STEM mới' })
  async register(@Body() data: any) {
    return this.stemService.registerLab(data);
  }

  @Post('labs/:id/book')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đặt lịch mượn thiết bị LAB STEM chống trùng' })
  async book(
    @Request() req: any,
    @Param('id') id: string,
    @Body('equipmentName') eqName: string,
    @Body('startTime') start: string,
    @Body('endTime') end: string,
  ) {
    return this.stemService.bookEquipment(req.user.id, id, eqName, new Date(start), new Date(end));
  }
}
