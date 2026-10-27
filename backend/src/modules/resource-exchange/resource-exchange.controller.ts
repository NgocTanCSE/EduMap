import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResourceMatchService } from './resource-exchange.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { CreateResourceRequestDto } from './dto/create-resource-request.dto';
import { ResourceMatchRankDto } from './dto/resource-match-rank.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Resource Exchange: Cung ↔ Cầu')
@Controller('resource-exchange')
export class ResourceExchangeController {
  constructor(private readonly resourceMatchService: ResourceMatchService) {}

  // ── Resources (Cung) ───────────────────────────────────────────────
  @Get('resources')
  @ApiOperation({ summary: 'Lấy danh sách nguồn lực đang có' })
  async getResources(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('location') location?: string,
  ) {
    return this.resourceMatchService.getResources({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      status,
      location,
    });
  }

  @Get('resources/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một nguồn lực' })
  async getResourceById(@Param('id') id: string) {
    return this.resourceMatchService.getResourceById(id);
  }

  @Post('resources')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng nguồn lực (cung cấp)' })
  async createResource(@Request() req: any, @Body() data: CreateResourceDto) {
    return this.resourceMatchService.createResource({ ...data, created_by: req.user?.id });
  }

  // ── Requests (Cần nhận) ────────────────────────────────────────────
  @Get('requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu nguồn lực' })
  async getResourceRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('need_type') need_type?: string,
    @Query('status') status?: string,
    @Query('location') location?: string,
  ) {
    return this.resourceMatchService.getResourceRequests({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      need_type,
      status,
      location,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một yêu cầu' })
  async getResourceRequestById(@Param('id') id: string) {
    return this.resourceMatchService.getResourceRequestById(id);
  }

  @Post('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng yêu cầu nguồn lực (cần nhận)' })
  async createResourceRequest(@Request() req: any, @Body() data: CreateResourceRequestDto) {
    return this.resourceMatchService.createResourceRequest({ ...data, created_by: req.user?.id });
  }

  // ── Matches (Kết quả ghép nối) ─────────────────────────────────────
  @Get('matches')
  @ApiOperation({ summary: 'Lấy danh sách cặp ghép' })
  async getResourceMatches(
    @Query('resource_id') resource_id?: string,
    @Query('request_id') request_id?: string,
    @Query('status') status?: string,
  ) {
    return this.resourceMatchService.getResourceMatches({ resource_id, request_id, status });
  }

  // ── Match (AI ranking + scheduling) ────────────────────────────────
  @Post('match')
  @ApiOperation({ summary: 'Ghép cung–cầu bằng AI (pre-filter + LLM ranking + greedy scheduling)' })
  async matchResources(@Body() params: ResourceMatchRankDto) {
    return this.resourceMatchService.matchResources(params);
  }
}
