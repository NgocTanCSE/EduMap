import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-SHARE: Chia sẻ tài nguyên & Sanitization (Học cụ & Sách)')
@Controller('share')
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
  @ApiOperation({ summary: 'Đăng tải sách/tài liệu/học cụ mới' })
  async createItem(@Req() req: any, @Body() data: any) {
    return this.shareService.createItem(req.user.id, data);
  }

  @Get('me/requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu mượn sách của tôi' })
  async getMyRequests(@Req() req: any) {
    return this.shareService.getUserBorrowRequests(req.user.id);
  }

  @Post('items/:id/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi yêu cầu mượn học cụ & tài liệu' })
  async requestItem(@Param('id') id: string, @Req() req: any, @Body('message') message: string) {
    return this.shareService.requestItem(id, req.user.id, message);
  }

  @Post('items/:id/return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác nhận chủ sở hữu nhận lại sách/tài liệu/học cụ' })
  async returnItem(@Param('id') id: string, @Req() req: any) {
    return this.shareService.returnItem(id, req.user.id);
  }
}
