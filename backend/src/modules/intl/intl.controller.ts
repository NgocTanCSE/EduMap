import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IntlService } from './intl.service';

@ApiTags('MOD-INTL: Bản đồ lưu học sinh & Quốc tế hóa (International Student Map)')
@Controller('intl')
export class IntlController {
  constructor(private readonly intlService: IntlService) {}

  @Get('programs')
  @ApiOperation({ summary: 'Lấy tất cả các chương trình trao đổi/học bổng quốc tế' })
  async findAll(@Query('type') type?: string) {
    return this.intlService.findAll(type);
  }

  @Post('programs')
  @ApiOperation({ summary: 'Đăng ký một chương trình giao lưu/học bổng mới' })
  async createProgram(@Body() body: any) {
    return this.intlService.createProgram(body);
  }

  @Get('alumni')
  @ApiOperation({ summary: 'Lấy danh sách tất cả lưu học sinh Việt Nam trên bản đồ' })
  async getAlumni() {
    return this.intlService.getAllAlumni();
  }

  @Get('alumni/nearby')
  @ApiOperation({ summary: 'Tìm kiếm lưu học sinh gần tọa độ của bạn (PostGIS)' })
  async getAlumniNearby(
    @Query('latitude') lat: number,
    @Query('longitude') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.intlService.getAlumniNearby(Number(lat), Number(lng), radius ? Number(radius) : undefined);
  }

  @Post('alumni')
  @ApiOperation({ summary: 'Đăng ký thông tin lưu học sinh học tập tại nước ngoài' })
  async registerAlumni(@Body() body: any) {
    return this.intlService.registerAlumni(body);
  }
}
