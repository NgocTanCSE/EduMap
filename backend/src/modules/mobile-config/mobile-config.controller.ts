import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MobileConfigService } from './mobile-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-MOBILE: Tri thức lưu động (Mobile Library/Classroom)')
@Controller('api/mobile-units')
export class MobileConfigController {
  constructor(private readonly mobileService: MobileConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các xe tri thức lưu động' })
  async getUnits() {
    return this.mobileService.getUnits();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký xe tri thức lưu động mới' })
  async createUnit(@Body() data: any) {
    return this.mobileService.createUnit(data);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Xem thông tin tài nguyên và lộ trình di chuyển của xe (Schedule & Resources)' })
  async getSchedule(@Param('id') id: string) {
    return this.mobileService.getUnitSchedule(id);
  }

  @Post(':id/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật định vị GPS thời gian thực của xe tri thức lưu động (Tracking)' })
  async updateLocation(
    @Param('id') id: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.mobileService.updateLocation(id, Number(lat), Number(lng));
  }

  @Post(':id/routes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lên kế hoạch lộ trình điểm dừng chân tiếp theo cho xe (Route Planning)' })
  async planRoute(
    @Param('id') id: string,
    @Body('destination') dest: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('time') time: Date,
  ) {
    return this.mobileService.planRoute(id, dest, Number(lat), Number(lng), time);
  }
}
