import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-DASH: Dashboard dữ liệu (Data & Heatmap)')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Lấy dữ liệu tổng quan cá nhân hóa cho người dùng' })
  async getOverview(@Request() req: any) {
    return this.dashService.getUserDashboard(req.user.id);
  }

  @Get('insight')
  @ApiOperation({ summary: 'Lấy lời khuyên mỗi ngày từ AI Gemini' })
  async getDailyInsight(@Request() req: any) {
    return this.dashService.getDailyInsight(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê thời gian thực và tọa độ Heatmap giáo dục (Admin)' })
  async getStats() {
    return this.dashService.getStats();
  }
}
