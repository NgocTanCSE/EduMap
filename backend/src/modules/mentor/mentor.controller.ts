import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MentorService } from './mentor.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookMentorDto } from './dto/book-mentor.dto';

@ApiTags('Mentoring')
@Controller('mentoring')
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @Post('register/:userId')
  @ApiOperation({ summary: 'Đăng ký trở thành Mentor' })
  async register(@Param('userId') userId: string, @Body() data: any) {
    return this.mentorService.registerMentor(userId, data);
  }

  @Get('mentors')
  @ApiOperation({ summary: 'Lấy danh sách các Mentor đã duyệt' })
  async getMentors(@Query('specialty') specialty: string) {
    return this.mentorService.getMentors(specialty);
  }

  @Get('mentors/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một Mentor' })
  async getMentorById(@Param('id') id: string) {
    return this.mentorService.getMentorById(id);
  }

  @Get('mentors/recommend/:userId')
  @ApiOperation({ summary: 'Gợi ý Mentor phù hợp bằng AI Gemini' })
  async getRecommendations(@Param('userId') userId: string) {
    return this.mentorService.getAIRecommendedMentors(userId);
  }

  @Get('mentors/:mentorId/slots')
  @ApiOperation({ summary: 'Lấy danh sách slot rảnh của Mentor' })
  async getSlots(@Param('mentorId') mentorId: string) {
    return this.mentorService.getMentorSlots(mentorId);
  }

  @Post('book')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đặt lịch hẹn tư vấn với Mentor' })
  async book(@Request() req: any, @Body() body: BookMentorDto) {
    return this.mentorService.bookMentor(
      req.user.id,
      body.mentorId,
      new Date(body.slotStart),
      new Date(body.slotEnd)
    );
  }

  @Patch('bookings/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái lịch hẹn' })
  async updateBookingStatus(
    @Param('id') id: string, 
    @Body('status') status: string, 
    @Request() req: any
  ) {
    return this.mentorService.updateBookingStatus(id, status, req.user.id);
  }

  @Get('me/bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử đặt lịch của tôi' })
  async getMyBookings(@Request() req: any) {
    return this.mentorService.getStudentBookings(req.user.id);
  }

  @Get('student/:studentId/bookings')
  @ApiOperation({ summary: 'Lấy lịch sử đặt lịch của học sinh (Admin/Staff)' })
  async getStudentBookings(@Param('studentId') studentId: string) {
    return this.mentorService.getStudentBookings(studentId);
  }

  @Get('mentor/:mentorId/bookings')
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của Mentor' })
  async getMentorBookings(@Param('mentorId') mentorId: string) {
    return this.mentorService.getMentorBookings(mentorId);
  }
}
