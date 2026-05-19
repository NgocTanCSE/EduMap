import { Controller, Post, Body, Param, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScholarshipService } from './scholarship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-18: Scholarship Map')
@Controller('scholarships')
export class ScholarshipController {
  constructor(private readonly scholarService: ScholarshipService) {}

  @Get(':id/check-eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ki?m tra xem sinh viên có ð? chu?n n?p h?c b?ng không' })
  async checkEligibility(@Request() req: any, @Param('id') id: string) {
    return this.scholarService.checkEligibility(req.user.id, id);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'N?p h? sõ xin h?c b?ng' })
  async apply(@Request() req: any, @Param('id') id: string, @Body('cvUrl') cvUrl: string) {
    return this.scholarService.applyScholarship(req.user.id, id, cvUrl);
  }
}

