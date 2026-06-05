import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HsConnectionService } from './hs-connection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-HS: Kết nối THPT')
@Controller('hs-connection')
export class HsConnectionController {
  constructor(private readonly hsService: HsConnectionService) {}

  @Get('counseling')
  @ApiOperation({ summary: 'Lấy danh sách các thông tin tuyển sinh đại học phục vụ học sinh THPT' })
  async getCounseling() {
    return this.hsService.getCounselingList();
  }

  @Post('counseling')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo/Cập nhật hồ sơ tuyển sinh đại học mới' })
  async createCounseling(@Body() data: any) {
    return this.hsService.createCounselingInfo(data);
  }

  @Post('campus-tour')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký Virtual Campus Tour và ghép cặp sinh viên đồng hành (Mentor Matching)' })
  async registerTour(@Request() req: any, @Body('universityName') uniName: string) {
    return this.hsService.registerCampusTour(req.user.id, uniName);
  }

  // --- SOCIAL NETWORK ENDPOINTS ---

  @Get('network')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy mạng lưới kết nối của tôi (Bạn bè, Yêu cầu, Gợi ý)' })
  async getMyNetwork(@Request() req: any) {
    return this.hsService.getMyNetwork(req.user.id);
  }

  @Post('network/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi yêu cầu kết bạn' })
  async sendRequest(@Request() req: any, @Body('receiverId') receiverId: string) {
    return this.hsService.sendConnectionRequest(req.user.id, receiverId);
  }

  @Post('network/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận hoặc từ chối yêu cầu kết bạn' })
  async respondToRequest(
    @Request() req: any, 
    @Body('connectionId') connectionId: string, 
    @Body('accept') accept: boolean
  ) {
    return this.hsService.respondToConnectionRequest(req.user.id, connectionId, accept);
  }
}
