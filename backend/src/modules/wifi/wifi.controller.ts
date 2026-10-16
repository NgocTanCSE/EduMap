import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WifiService } from './wifi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-WIFI: Bản đồ phủ sóng Wifi')
@Controller('wifi')
export class WifiController {
  constructor(private readonly wifiService: WifiService) {}

  @Get('locations')
  @ApiOperation({ summary: 'Lấy tất cả các điểm Wifi phủ sóng công cộng' })
  async getWifi() {
    return this.wifiService.getWifiPoints();
  }

  @Get('locations/nearby')
  @ApiOperation({ summary: 'Tìm các điểm Wifi gần nhất qua GIS PostGIS' })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.wifiService.getWifiPointsNearby(Number(lat), Number(lng), radius ? Number(radius) : undefined);
  }

  @Post('locations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Báo cáo chia sẻ điểm Wifi miễn phí mới' })
  async report(@Request() req: any, @Body() data: any) {
    return this.wifiService.reportWifi(req.user.id, data);
  }

  @Post('locations/:id/speed-test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp kết quả kiểm tra tốc độ Wifi (Speed-test)' })
  async submitSpeedTest(
    @Request() req: any,
    @Param('id') id: string,
    @Body('downloadSpeed') downloadSpeed: number,
    @Body('uploadSpeed') uploadSpeed: number,
    @Body('rating') rating: number,
  ) {
    return this.wifiService.submitSpeedTest(id, Number(downloadSpeed), Number(uploadSpeed), Number(rating));
  }
}
