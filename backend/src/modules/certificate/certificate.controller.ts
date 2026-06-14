import { Controller, Get, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certService: CertificateService) {}

  @Post('issue')
  @ApiOperation({ summary: 'Cấp chứng nhận số mới' })
  async issue(@Body() data: { userId: string; templateId: string }) {
    return this.certService.issueCertificate(data.userId, data.templateId);
  }

  @Get('verify/:code')
  @ApiOperation({ summary: 'Xác thực chứng nhận số' })
  async verify(@Param('code') code: string) {
    return this.certService.verifyCertificate(code);
  }

  @Get('portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy hồ sơ năng lực cá nhân' })
  async getMyPortfolio(@Request() req: any) {
    return this.certService.getUserPortfolio(req.user.id);
  }

  @Get('download/:code.pdf')
  @ApiOperation({ summary: 'Tải tệp tin PDF chứng nhận' })
  async downloadPdf(@Param('code') code: string, @Res() res: Response) {
    const buffer = await this.certService.generateCertificatePdf(code);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=certificate-${code}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
