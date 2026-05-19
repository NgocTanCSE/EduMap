import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LearningCommunityService } from './learning-community.service';

@ApiTags('MOD-23: Community Learning Map')
@Controller('learning-spots')
export class LearningCommunityController {
  constructor(private readonly learnService: LearningCommunityService) {}

  @Get(':id/availability')
  @ApiOperation({ summary: 'Ki?m tra t?nh tr?ng ch? tr?ng th?i gian th?c' })
  async getAvailability(@Param('id') id: string) {
    return this.learnService.checkAvailability(id);
  }
}
