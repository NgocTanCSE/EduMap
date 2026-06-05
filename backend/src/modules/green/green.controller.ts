import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GreenCampusService } from './green.service';

@ApiTags('Green')
@Controller('green')
export class GreenController {
  constructor(private readonly greenService: GreenCampusService) { }

  @Get('challenges')
  @ApiOperation({ summary: 'Danh sách thử thách xanh' })
  async getChallenges() {
    return this.greenService.getChallenges();
  }
}
