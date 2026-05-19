import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-SHARE: Chia sẻ tài nguyên & Sanitization (Học cụ & Sách)')
@Controller('api/share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('items')
  @ApiOperation({ summary: 'Lấy danh sách sách/tài liệu/học cụ có sẵn để mượn' })
  async getItems(@Query('category') category?: string) {
    return this.shareService.getItems(category);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký chia sẻ sách/tài liệu/học cụ mới (Có lọc XSS)' })
  async createItem(@Req() req: any, @Body() body: any) {
    return this.shareService.createItem(req.user.id, body);
  }

  @Post('items/:id/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yêu cầu mượn sách/tài liệu và lấy mã tracking vận chuyển' })
  async requestItem(@Param('id') id: string, @Req() req: any) {
    return this.shareService.requestItem(id, req.user.id);
  }

  @Post('items/:id/return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác nhận chủ sở hữu nhận lại sách/tài liệu/học cụ' })
  async returnItem(@Param('id') id: string, @Req() req: any) {
    return this.shareService.returnItem(id, req.user.id);
  }
}
