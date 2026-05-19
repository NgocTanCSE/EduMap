import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-22: Ch?ng nh?n ði?n t?')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certService: CertificateService) {}

  @Get('verify/:code')
  @ApiOperation({ summary: 'Xác th?c tính h?p l? c?a ch?ng nh?n (Verify)' })
  async verify(@Param('code') code: string) {
    return this.certService.verifyCertificate(code);
  }

  @Get('portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'L?y h? sõ nãng l?c ch?a các ch?ng ch? (Portfolio)' })
  async getPortfolio(@Request() req: any) {
    return this.certService.getUserPortfolio(req.user.id);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'T? ð?ng c?p ch?ng nh?n (Thý?ng ðý?c g?i n?i b? t? h? th?ng Events)' })
  async generate(
    @Request() req: any,
    @Body('title') title: string,
    @Body('type') type: string,
    @Body('issuer') issuer: string
  ) {
    return this.certService.generateCertificate(req.user.id, title, type, issuer);
  }
}

