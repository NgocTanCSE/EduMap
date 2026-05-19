import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Donate')
@Controller('donations')
export class DonateController {
  @Get('campaigns')
  @ApiOperation({ summary: 'Danh sach chien dich quyen gop' })
  async getCampaigns(@Query() query: any) {
    return { campaigns: [] };
  }

  @Post()
  @ApiOperation({ summary: 'Thuc hien quyen gop' })
  async createDonation(@Body() body: any) {
    return { status: 'success', receipt_id: 'REC-123' };
  }
}
