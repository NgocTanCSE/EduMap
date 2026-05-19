import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  
  @Get('groups')
  @ApiOperation({ summary: 'Danh sach nhom hoc tap' })
  async getGroups() {
    return { groups: [] };
  }

  @UseGuards(JwtAuthGuard)
  @Post('groups/:id/join')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tham gia nhom' })
  async joinGroup(@Param('id') id: string) {
    return { message: 'Da tham gia' };
  }
}
