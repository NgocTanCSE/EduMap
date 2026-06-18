import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CrawlerService } from './crawler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Crawler')
@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a crawl process' })
  @ApiResponse({ status: 200, description: 'Crawl process triggered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid crawl type' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async triggerCrawl(@Body() body: { type: string; params?: any }) {
    const { type, params } = body;
    return this.crawlerService.triggerCrawl(type, params);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current crawl status' })
  @ApiResponse({ status: 200, description: 'Return current crawl status' })
  async getCrawlStatus() {
    return this.crawlerService.getCrawlStatus();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get crawl history' })
  @ApiResponse({ status: 200, description: 'Return crawl history' })
  async getCrawlHistory() {
    return this.crawlerService.getCrawlHistory();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get crawl statistics' })
  @ApiResponse({ status: 200, description: 'Return crawl statistics' })
  async getCrawlStats() {
    return this.crawlerService.getCrawlStats();
  }

  @Get('types')
  @ApiOperation({ summary: 'Get available crawl types' })
  @ApiResponse({ status: 200, description: 'Return available crawl types' })
  async getCrawlTypes() {
    return this.crawlerService.getCrawlTypes();
  }
}
