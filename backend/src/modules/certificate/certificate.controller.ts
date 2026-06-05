import { Controller, Get, Post, Body, Param, UseGuards, Req, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('MOD-CERT: Chứng nhận điện tử & Blockchain (Digital Certificate)')
@Controller('certificates')
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

  @Post('issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cấp chứng nhận điện tử mới (Chỉ dành cho Admin/System)' })
  async issueCertificate(
    @Body('user_id') userId: string,
    @Body('template_id') templateId: string,
  ) {
    return this.certService.issueCertificate(userId, templateId);
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi chứng chỉ' })
  async revokeCertificate(@Param('id') id: string) {
    return this.certService.revokeCertificate(id);
  }
}
