import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HackathonService } from './hackathon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-HACK: Sân chơi Hackathon & Ý tưởng Đổi mới')
@Controller('api/hackathons')
export class HackathonController {
  constructor(private readonly hackService: HackathonService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các cuộc thi Hackathon' })
  async getHackathons() {
    return this.hackService.getHackathons();
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký đội thi tham dự Hackathon mới' })
  async register(@Req() req: any, @Body() body: any) {
    return this.hackService.registerTeam(req.user.id, body);
  }

  @Post('teams/:teamId/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp sản phẩm dự thi (Repo, Demo video) của đội' })
  async submit(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Body('repoUrl') repoUrl: string,
    @Body('demoVideo') demoVideo: string,
  ) {
    return this.hackService.submitProject(req.user.id, teamId, repoUrl, demoVideo);
  }

  @Post('teams/:teamId/judge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban giám khảo chấm điểm dự án của đội thi' })
  async judge(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Body('scores') scores: any[],
    @Body('feedback') feedback?: string,
  ) {
    return this.hackService.judgeProject(req.user.id, teamId, scores, feedback);
  }
}
