import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { HsConnectionService } from './hs-connection.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('HS-Uni Connection')
@Controller('hs-connection')
export class HsConnectionController {
  constructor(private readonly hsService: HsConnectionService) {}

  @Get('counseling')
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ tư vấn tuyển sinh' })
  async getCounseling() {
    return this.hsService.getCounselingList();
  }

  @Post('campus-tour')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký Campus Tour ảo' })
  async registerTour(@Request() req: any, @Body('university') university: string) {
    return this.hsService.registerCampusTour(req.user.id, university);
  }

  @Post('questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đặt câu hỏi tư vấn' })
  async createQuestion(@Request() req: any, @Body() data: any) {
    return this.hsService.createQuestion(req.user.id, data);
  }

  @Get('questions')
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi' })
  async getQuestions(@Query('university') university: string) {
    return this.hsService.getQuestions(university);
  }

  @Post('questions/:id/answers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trả lời câu hỏi (Sinh viên đại học)' })
  async answerQuestion(@Request() req: any, @Param('id') id: string, @Body('content') content: string) {
    return this.hsService.answerQuestion(req.user.id, id, content);
  }

  @Post('connect/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi yêu cầu kết nối' })
  async connect(@Request() req: any, @Param('userId') userId: string) {
    return this.hsService.sendConnectionRequest(req.user.id, userId);
  }

  @Get('my-network')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy mạng lưới kết nối của tôi' })
  async getMyNetwork(@Request() req: any) {
    return this.hsService.getMyNetwork(req.user.id);
  }

  @Post('network/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Phản hồi yêu cầu kết bạn (Chấp nhận/Từ chối)' })
  async respondToRequest(@Request() req: any, @Body('connectionId') connectionId: string, @Body('accept') accept: boolean) {
    return this.hsService.respondToConnectionRequest(req.user.id, connectionId, accept);
  }
}
