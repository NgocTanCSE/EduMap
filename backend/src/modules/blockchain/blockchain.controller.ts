import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Xác thực mã chứng chỉ blockchain' })
  @ApiParam({ name: 'code', description: 'Mã chứng chỉ cần xác thực' })
  async verify(@Param('code') code: string) {
    if (!code) {
      return { success: false, message: 'Mã chứng chỉ không được để trống' };
    }
    return {
      success: true,
      data: await this.blockchainService.verifyHash(code)
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('issue')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ký số và cấp chứng chỉ mới' })
  async issueCertificate(
    @Body('userId') userId: string,
    @Body('certCode') certCode: string,
    @Body('templateName') templateName: string
  ) {
    if (!userId || !certCode || !templateName) {
      return { success: false, message: 'Thiếu thông tin cần thiết' };
    }
    return {
      success: true,
      data: await this.blockchainService.signCertificate(userId, certCode, templateName)
    };
  }
}