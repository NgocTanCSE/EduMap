import { Controller, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-28: Chia s? sách & tài li?u')
@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('items/:id/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yêu c?u mý?n sách/tài li?u và l?y m? tracking' })
  async requestItem(@Param('id') id: string, @Request() req: any) {
    return this.shareService.requestItem(id, req.user.id);
  }
}

