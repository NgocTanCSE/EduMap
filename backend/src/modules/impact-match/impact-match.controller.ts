import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ImpactMatchService } from './impact-match.service';
import { CreateSponsorNeedDto } from './dto/create-sponsor-need.dto';
import { CreateSponsorProfileDto } from './dto/create-sponsor-profile.dto';
import { ImpactMatchRankDto } from './dto/impact-match-rank.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ImpactMatch: Need ↔ Sponsor')
@Controller('impact-match')
export class ImpactMatchController {
  constructor(private readonly impactMatchService: ImpactMatchService) {}

  // ── Sponsor Needs ──────────────────────────────────────────────
  @Get('needs')
  @ApiOperation({ summary: 'Lấy danh sách nhu cầu cần tài trợ' })
  async getSponsorNeeds(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('urgency') urgency?: string,
    @Query('location') location?: string,
  ) {
    return this.impactMatchService.getSponsorNeeds({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category, status, urgency, location,
    });
  }

  @Get('needs/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một nhu cầu' })
  async getSponsorNeedById(@Param('id') id: string) {
    return this.impactMatchService.getSponsorNeedById(id);
  }

  @Post('needs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo nhu cầu cần tài trợ mới' })
  async createSponsorNeed(@Request() req: any, @Body() data: CreateSponsorNeedDto) {
    return this.impactMatchService.createSponsorNeed({ ...data, created_by: req.user?.id });
  }

  // ── Sponsor Profiles ───────────────────────────────────────────
  @Get('sponsors')
  @ApiOperation({ summary: 'Lấy danh sách nhà tài trợ' })
  async getSponsorProfiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('focus_area') focus_area?: string,
    @Query('location') location?: string,
    @Query('is_verified') is_verified?: string,
  ) {
    return this.impactMatchService.getSponsorProfiles({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      focus_area, location,
      is_verified: is_verified !== undefined ? is_verified === 'true' : undefined,
    });
  }

  @Get('sponsors/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một nhà tài trợ' })
  async getSponsorProfileById(@Param('id') id: string) {
    return this.impactMatchService.getSponsorProfileById(id);
  }

  @Post('sponsors')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo hồ sơ nhà tài trợ mới' })
  async createSponsorProfile(@Request() req: any, @Body() data: CreateSponsorProfileDto) {
    return this.impactMatchService.createSponsorProfile({ ...data, created_by: req.user?.id });
  }

  // ── Rank / Match ───────────────────────────────────────────────
  @Post('rank')
  @ApiOperation({ summary: 'Xếp hạng ghép nhu cầu ↔ nhà tài trợ bằng AI (pre-filter + LLM) — on-demand refresh' })
  async rankMatches(
    @Body() params: ImpactMatchRankDto,
  ) {
    return this.impactMatchService.rankMatches(params);
  }

  // ── Cached rankings (auto-scheduler) ──
  @Get('rankings/cached')
  @ApiOperation({ summary: 'Lấy kết quả xếp hạng đã được auto-scheduler tính toán (GET — không chờ LLM)' })
  async getCachedRankings(@Query('refresh') refresh?: string) {
    return this.impactMatchService.getCachedRankings(refresh === 'true');
  }
}
