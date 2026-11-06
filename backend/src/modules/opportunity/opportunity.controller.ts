import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OpportunityService } from './opportunity.service';
import { OpportunityMatchingService } from './opportunity-matching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
@ApiTags('MOD-OPP: Student Opportunity Map (Bản đồ cơ hội)')
@Controller('opportunities')
export class OpportunityController {
    constructor(private readonly oppService: OpportunityService, private readonly oppMatchService: OpportunityMatchingService) { }
    @Get()
    @ApiOperation({ summary: 'F-16: Hiển thị các cơ hội (Thực tập, Học bổng, Cuộc thi) trên bản đồ' })
    async getOpportunities(
    @Query('type')
    type?: string, 
    @Query('field')
    field?: string, 
    @Query('bounds')
    bounds?: string) {
        return this.oppService.getOpportunities(type, field, bounds);
    }
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Đăng tải cơ hội học tập/thực tập mới' })
    async create(
    @Body()
    body: any) {
        return this.oppService.createOpportunity(body);
    }
    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin chi tiết một cơ hội' })
    async findOne(
    @Param('id')
    id: string) {
        return this.oppService.findOne(id);
    }
    @Post(':id/team-finding')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Bật/Tắt tìm đồng đội tham gia cơ hội (dành cho học sinh/sinh viên)' })
    async toggleTeamFinding(
    @Param('id')
    id: string) {
        return this.oppService.toggleTeamFinding(id);
    }
    @Post('match')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'F-16b: Opportunity Radar — match scholarships/jobs/opportunities against user profile' })
    async matchOpportunities(
    @Request()
    req: any, 
    @Body()
    body?: {
        type?: string;
        field?: string;
        limit?: number;
        gpa?: number;
    }) {
        const userId = req.user.id || req.user.sub;
        const options: any = {};
        if (body?.type)
            options.type = body.type;
        if (body?.field)
            options.field = body.field;
        if (body?.limit)
            options.limit = Number(body.limit);
        const overrides: any = {};
        if (body?.gpa != null)
            overrides.gpa = Number(body.gpa);
        return this.oppMatchService.matchOpportunities(userId, options, overrides);
    }
}
