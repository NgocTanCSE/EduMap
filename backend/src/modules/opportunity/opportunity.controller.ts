import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OpportunityService } from './opportunity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-OPP: Student Opportunity Map (Bản đồ cơ hội)')
@Controller('api/opportunities')
export class OpportunityController {
  constructor(private readonly oppService: OpportunityService) {}

  @Get()
  @ApiOperation({ summary: 'F-16: Hiển thị các cơ hội (Thực tập, Học bổng, Cuộc thi) trên bản đồ' })
  async getOpportunities(
    @Query('type') type?: string,
    @Query('field') field?: string,
    @Query('bounds') bounds?: string, // Định dạng: minLng,minLat,maxLng,maxLat
  ) {
    return this.oppService.getOpportunities(type, field, bounds);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng tải cơ hội học tập/thực tập mới' })
  async create(@Body() body: any) {
    return this.oppService.createOpportunity(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một cơ hội' })
  async findOne(@Param('id') id: string) {
    return this.oppService.findOne(id);
  }

  @Post(':id/team-finding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bật/Tắt tìm đồng đội tham gia cơ hội (dành cho học sinh/sinh viên)' })
  async toggleTeamFinding(@Param('id') id: string) {
    return this.oppService.toggleTeamFinding(id);
  }
}
