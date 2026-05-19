import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Green')
@Controller('green')
export class GreenController {
  @Get('challenges')
  @ApiOperation({ summary: 'Danh sach thu thach xanh' })
  async getChallenges() {
    return { challenges: [] };
  }
}
