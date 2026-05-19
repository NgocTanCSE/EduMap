import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Volunteer')
@Controller('volunteers')
export class VolunteerController {
  @Get('activities')
  @ApiOperation({ summary: 'Lich su hoat dong tinh nguyen' })
  async getActivities() {
    return { activities: [], total_hours: 0 };
  }
}
