import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-DASH: Dashboard dữ liệu (Data & Heatmap)')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê thời gian thực và tọa độ Heatmap giáo dục' })
  async getStats() {
    return this.dashService.getStats();
  }
}
