import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Wifi')
@Controller('wifi')
export class WifiController {
  @Get('locations')
  @ApiOperation({ summary: 'Tim diem wifi mien phi' })
  async getWifi(@Query('bounds') bounds: string) {
    return { locations: [] };
  }
}
