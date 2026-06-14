import { Controller, Post, Get, Body, Req, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  async track(@Body() data: { event_type: string; metadata: any }, @Req() req: any) {
    // Nếu có user trong request (đã login), thì gắn userId vào
    const userId = req.user?.id || data.metadata?.userId; 
    return await this.analyticsService.trackEvent(userId, data.event_type, data.metadata);
  }

  @Get('stats')
  async getStats() {
    return await this.analyticsService.getGlobalStats();
  }

  @Get('education')
  async getEducationStats(
    @Query('year') year?: string,
    @Query('region') region?: string,
  ) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return await this.analyticsService.getEducationStats(yearNum, region);
  }
}
