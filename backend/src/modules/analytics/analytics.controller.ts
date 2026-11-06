import { Controller, Post, Get, Body, Req, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AnalyticsService } from './analytics.service';
import { Public } from '../../common/decorators/public.decorator';
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Public()
  @Post('track')
  async track(
    @Body() data: { event_type: string; metadata: any },
    @Req() req: any) {
    const userId = req.user?.id || data.metadata?.userId;
    return await this.analyticsService.trackEvent(userId, data.event_type, data.metadata);
  }

  @Get('stats')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  async getStats() {
    return await this.analyticsService.getGlobalStats();
  }

  @Get('education')
  async getEducationStats(
    @Query('year') year?: string,
    @Query('region') region?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return await this.analyticsService.getEducationStats(yearNum, region);
  }
}
