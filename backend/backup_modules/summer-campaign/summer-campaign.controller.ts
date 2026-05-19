import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SummerCampaignService } from './summer-campaign.service';

@ApiTags('MOD-27: Mùa hè xanh')
@Controller('summer-campaigns')
export class SummerCampaignController {
  constructor(private readonly summerService: SummerCampaignService) {}

  @Get(':id/daily-report')
  @ApiOperation({ summary: 'L?y báo cáo ti?n ð? chi?n d?ch h?ng ngày' })
  async getReport(@Param('id') id: string, @Query('date') date: string) {
    return this.summerService.getDailyReport(id, date);
  }
}

