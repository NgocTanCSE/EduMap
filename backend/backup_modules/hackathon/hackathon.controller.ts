import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HackathonService } from './hackathon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-20: Hackathon & Challenges')
@Controller('hackathons')
export class HackathonController {
  constructor(private readonly hackService: HackathonService) {}

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'N?p s?n ph?m d? thi (Repo, Demo video)' })
  async submit(@Request() req: any, @Param('id') id: string, @Body('repoUrl') url: string, @Body('demoVideo') video: string) {
    return this.hackService.submitProject(req.user.id, id, url, video);
  }

  @Post('judge/:submissionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban giám kh?o ch?m ði?m d? án' })
  async judge(@Request() req: any, @Param('submissionId') subId: string, @Body('scores') scores: any[]) {
    return this.hackService.judgeProject(req.user.id, subId, scores);
  }
}

