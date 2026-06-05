import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VolunteerService } from './volunteer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Volunteer')
@Controller('volunteers')
export class VolunteerController {
  constructor(private readonly volunteerService: VolunteerService) {}

  @Get('activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử hoạt động tình nguyện của tôi' })
  async getActivities(@Request() req: any) {
    return this.volunteerService.getUserActivities(req.user.id);
  }

  @Post('activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ghi nhận giờ tình nguyện mới' })
  async logActivity(
    @Request() req: any,
    @Body() body: { title: string; description: string; campaign_name: string; hours: number; date: string }
  ) {
    return this.volunteerService.logVolunteerActivity(req.user.id, body);
  }
}
