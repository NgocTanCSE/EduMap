import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { SummerCampaignService } from './summer.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Summer Volunteer')
@Controller('summer')
export class SummerCampaignController {
  constructor(private readonly summerService: SummerCampaignService) {}

  @Post('campaigns')
  @ApiOperation({ summary: 'Tạo chiến dịch mới (Admin)' })
  async create(@Body() data: any) {
    return this.summerService.createCampaign(data);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Lấy danh sách tất cả chiến dịch' })
  async getCampaigns() {
    return this.summerService.getCampaigns();
  }

  @Post('campaigns/:id/activities')
  @ApiOperation({ summary: 'Ghi nhận hoạt động trong ngày cho chiến dịch' })
  async addActivity(@Param('id') campaignId: string, @Body() data: any) {
    return this.summerService.addActivity(campaignId, data);
  }

  @Get('campaigns/:id/daily-report')
  @ApiOperation({ summary: 'Báo cáo hoạt động hằng ngày của chiến dịch' })
  async getDailyReport(@Param('id') campaignId: string, @Query('date') date: string) {
    return this.summerService.getDailyReport(campaignId, date);
  }

  @Post('campaigns/:id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký tham gia chiến dịch' })
  async register(@Param('id') campaignId: string, @Request() req: any) {
    return this.summerService.registerVolunteer(campaignId, req.user.id);
  }

  @Patch('registrations/:id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái đăng ký (Duyệt TNV)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: 'approved' | 'rejected') {
    return this.summerService.updateRegistrationStatus(id, status);
  }
}
