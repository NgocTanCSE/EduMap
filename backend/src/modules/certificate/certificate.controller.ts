import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-CERT: Chứng nhận điện tử & Blockchain (Digital Certificate)')
@Controller('api/certificates')
export class CertificateController {
  constructor(private readonly certService: CertificateService) {}

  @Get('verify/:code')
  @ApiOperation({ summary: 'Xác thực tính hợp lệ của chứng nhận điện tử (Verify)' })
  async verify(@Param('code') code: string) {
    return this.certService.verifyCertificate(code);
  }

  @Get('portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy hồ sơ năng lực chứa các chứng chỉ (Portfolio) của người dùng' })
  async getPortfolio(@Req() req: any) {
    return this.certService.getUserPortfolio(req.user.id);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cấp chứng nhận điện tử mới (Thường gọi nội bộ từ hệ thống Events/Courses)' })
  async generate(
    @Req() req: any,
    @Body('title') title: string,
    @Body('type') type: string,
    @Body('issuer') issuer: string,
  ) {
    return this.certService.generateCertificate(req.user.id, title, type, issuer);
  }
}
