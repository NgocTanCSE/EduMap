import { Controller, Get, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  
  @Get('dashboard')
  @ApiOperation({ summary: 'Lay thong ke Dashboard Admin' })
  async getStats(@Query('period') period: string) {
    // Mock data based on Sheet 6 requirements
    return {
      total_users: 1540,
      active_campaigns: 12,
      pending_verifications: 45,
      revenue_growth: '+12.5%',
      charts: {
        user_growth: [120, 450, 800, 1540]
      }
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Danh sach nguoi dung' })
  async getUsers(@Query() query: any) {
    return {
      users: [],
      total: 0,
      page: query.page || 1
    };
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Thay doi trang thai nguoi dung (Ban/Unban)' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string, reason: string }
  ) {
    return { id, status: body.status, message: 'Cap nhat thanh cong' };
  }

  @Get('content/pending')
  @ApiOperation({ summary: 'Danh sach noi dung cho duyet' })
  async getPendingContent(@Query('type') type: string) {
    return {
      type,
      items: [],
      count: 0
    };
  }
}
