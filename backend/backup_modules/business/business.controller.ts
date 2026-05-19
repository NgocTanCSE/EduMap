import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/entities/user.entity';

@ApiTags('MOD-11: K?t n?i Doanh nghi?p')
@Controller('business')
export class BusinessController {
  constructor(private readonly bizService: BusinessService) {}

  @Get(':id/profile')
  @ApiOperation({ summary: 'H? sõ doanh nghi?p' })
  async getProfile(@Param('id') id: string) { return this.bizService.getCompanyProfile(id); }

  @Post(':id/internship')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS) // CH? TÀI KHO?N DOANH NGHI?P ÐÝ?C ÐÃNG TUY?N D?NG
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Doanh nghi?p ðãng tuy?n d?ng th?c t?p' })
  async postJob(@Param('id') id: string, @Body('jobDetails') details: any) {
    return this.bizService.postInternship(id, details);
  }
}

