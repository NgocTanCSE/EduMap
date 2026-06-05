import { Controller, Post, Body, Param, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScholarshipService } from './scholarship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplyScholarshipDto } from './dto/apply-scholarship.dto';

@ApiTags('Scholarships')
@Controller('scholarships')
export class ScholarshipController {
  constructor(private readonly scholarService: ScholarshipService) { }

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả danh sách học bổng' })
  async findAll() {
    return this.scholarService.getAllScholarships();
  }

  @Get(':id/check-eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra độ phù hợp của người dùng với học bổng' })
  async check(@Request() req: any, @Param('id') id: string) {
    return this.scholarService.checkEligibility(req.user.id, id);
  }

  @Get('me/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách đơn nộp học bổng của tôi' })
  async getMyApplications(@Request() req: any) {
    return this.scholarService.getUserApplications(req.user.id);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp hồ sơ xin học bổng' })
  async apply(
    @Request() req: any, 
    @Param('id') id: string, 
    @Body() applyDto: ApplyScholarshipDto
  ) {
    return this.scholarService.applyScholarship(
      req.user.id, 
      id, 
      applyDto.personal_statement, 
      applyDto.cv_url
    );
  }
}
