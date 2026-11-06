import { Controller, Post, Put, Body, Param, UseGuards, Request, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScholarshipService } from './scholarship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { ApplyScholarshipDto } from './dto/apply-scholarship.dto';
@ApiTags('Scholarships')
@Controller('scholarships')
export class ScholarshipController {
    constructor(private readonly scholarService: ScholarshipService) { }
    @Get()
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300000)
    @ApiOperation({ summary: 'Lấy tất cả danh sách học bổng' })
    async findAll(
    @Query('page')
    page?: string, 
    @Query('limit')
    limit?: string) {
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : 10;
        return this.scholarService.getAllScholarships(pageNum, limitNum);
    }
    @Get(':id')
    @ApiOperation({ summary: 'Lấy chi tiết một học bổng theo ID' })
    async getById(
    @Param('id')
    id: string) {
        return this.scholarService.getScholarshipById(id);
    }
    @Post(':id/check-eligibility')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Kiểm tra độ phù hợp của người dùng với học bổng (hỗ trợ truyền GPA từ bảng điểm PDF)' })
    async check(
    @Request()
    req: any, 
    @Param('id')
    id: string, 
    @Body()
    body?: any) {
        return this.scholarService.checkEligibility(req.user.id, id, body);
    }
    @Get('me/applications')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Lấy danh sách đơn nộp học bổng của tôi' })
    async getMyApplications(
    @Request()
    req: any) {
        return this.scholarService.getUserApplications(req.user.id);
    }
    @Post(':id/apply')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Nộp hồ sơ xin học bổng' })
    async apply(
    @Request()
    req: any, 
    @Param('id')
    id: string, 
    @Body()
    applyDto: ApplyScholarshipDto) {
        return this.scholarService.applyScholarship(req.user.id, id, applyDto.personal_statement, applyDto.cv_url);
    }
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MODERATOR)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo học bổng mới (Tự động đồng bộ sang AI)' })
    async create(
    @Body()
    createDto: any) {
        return this.scholarService.createScholarship(createDto);
    }
    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MODERATOR)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cập nhật học bổng (Tự động đồng bộ sang AI)' })
    async update(
    @Param('id')
    id: string, 
    @Body()
    updateDto: any) {
        return this.scholarService.updateScholarship(id, updateDto);
    }
}
