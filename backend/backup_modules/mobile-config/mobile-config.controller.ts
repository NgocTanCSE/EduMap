import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MobileConfigService } from './mobile-config.service';

@ApiTags('MOD-26: Tri th?c lýu ð?ng (Mobile Library/Classroom)')
@Controller('mobile-units')
export class MobileConfigController {
  constructor(private readonly mobileService: MobileConfigService) {}

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Xem thông tin tài nguyên và l?ch tr?nh c?a xe (Schedule & Resources)' })
  async getSchedule(@Param('id') id: string) {
    return this.mobileService.getUnitSchedule(id);
  }

  @Post(':id/location')
  @ApiOperation({ summary: 'C?p nh?t v? trí GPS th?i gian th?c c?a xe (Tracking)' })
  async updateLocation(
    @Param('id') id: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number
  ) {
    return this.mobileService.updateLocation(id, lat, lng);
  }

  @Post(':id/routes')
  @ApiOperation({ summary: 'Lên l?ch tr?nh ði?m ð?n m?i cho xe (Route Planning)' })
  async planRoute(
    @Param('id') id: string,
    @Body('destination') dest: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('time') time: Date
  ) {
    return this.mobileService.planRoute(id, dest, lat, lng, time);
  }
}

