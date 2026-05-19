import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard (D? li?u & Heatmap)')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get realtime dashboard statistics and heatmap data' })
  async getStats() {
    return this.dashService.getStats();
  }
}
