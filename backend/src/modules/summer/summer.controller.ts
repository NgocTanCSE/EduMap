import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SummerCampaignService } from './summer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-SUMMER: Chiến dịch Mùa hè xanh')
@Controller('summer-campaigns')
export class SummerCampaignController {
  constructor(private readonly summerService: SummerCampaignService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả các chiến dịch Mùa hè xanh' })
  async getCampaigns() {
    return this.summerService.getCampaigns();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo chiến dịch Mùa hè xanh mới' })
  async create(@Body() data: any) {
    return this.summerService.createCampaign(data);
  }

  @Get(':id/daily-report')
  @ApiOperation({ summary: 'Lấy báo cáo tiến độ hoạt động hằng ngày của chiến dịch' })
  async getReport(@Param('id') id: string, @Query('date') date: string) {
    return this.summerService.getDailyReport(id, date);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký tham gia tình nguyện viên Chiến dịch mùa hè xanh' })
  async register(@Request() req: any, @Param('id') id: string) {
    return this.summerService.registerVolunteer(id, req.user.id);
  }
}
