import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MentorService } from './mentor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-MENTOR: Kết nối Mentor-Mentee')
@Controller('api/mentoring')
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @Get('mentors')
  @ApiOperation({ summary: 'Lấy danh sách Mentor được phê duyệt trong hệ thống' })
  async getMentors(@Query('specialty') specialty?: string) {
    return this.mentorService.getMentors(specialty);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng hiện tại thành Mentor' })
  async register(@Req() req: any, @Body() body: any) {
    return this.mentorService.registerMentor(req.user.id, body);
  }

  @Get('mentors/:id/slots')
  @ApiOperation({ summary: 'Lấy danh sách các khung giờ trống của Mentor' })
  async getSlots(@Param('id') mentorId: string) {
    return this.mentorService.getMentorSlots(mentorId);
  }

  @Post('mentors/:id/bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đặt lịch hẹn tư vấn học tập định hướng với Mentor' })
  async createBooking(
    @Req() req: any,
    @Param('id') mentorId: string,
    @Body('slot_start') slotStart: Date,
    @Body('slot_end') slotEnd: Date,
  ) {
    return this.mentorService.bookMentor(req.user.id, mentorId, new Date(slotStart), new Date(slotEnd));
  }

  @Get('bookings/student')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn tư vấn đã đặt của Học sinh (Mentee)' })
  async getStudentBookings(@Req() req: any) {
    return this.mentorService.getStudentBookings(req.user.id);
  }

  @Get('bookings/mentor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn tư vấn học sinh đặt của Mentor' })
  async getMentorBookings(@Req() req: any) {
    return this.mentorService.getMentorBookings(req.user.id);
  }
}
