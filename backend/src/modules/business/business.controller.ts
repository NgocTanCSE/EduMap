import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('MOD-BIZ: Kết nối doanh nghiệp')
@Controller('api/business')
export class BusinessController {
  constructor(private readonly bizService: BusinessService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả hồ sơ doanh nghiệp liên kết' })
  async getProfiles() {
    return this.bizService.getAllProfiles();
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết hồ sơ doanh nghiệp' })
  async getProfile(@Param('id') id: string) {
    return this.bizService.getCompanyProfile(id);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mới hoặc cập nhật thông tin hồ sơ doanh nghiệp' })
  async createOrUpdate(@Request() req: any, @Body() data: any) {
    return this.bizService.createOrUpdateProfile(req.user.id, data);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác minh hồ sơ doanh nghiệp liên kết (Dành cho Quản trị viên)' })
  async verify(@Param('id') id: string) {
    return this.bizService.verifyProfile(id);
  }
}
