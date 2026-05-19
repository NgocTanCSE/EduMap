import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Mentor')
@Controller('mentoring')
export class MentorController {
  
  @Get('mentors')
  @ApiOperation({ summary: 'Danh sach Mentor' })
  async getMentors(@Query() query: any) {
    return { mentors: [] };
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dat lich hen voi Mentor' })
  async createBooking(@Body() body: any) {
    return { booking_id: '123', status: 'pending' };
  }
}
