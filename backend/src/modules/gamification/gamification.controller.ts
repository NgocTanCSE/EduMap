import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Gamification & Green')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('submit-activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp minh chứng hoạt động Xanh' })
  async submit(@Request() req: any, @Body() data: any) {
    return this.gamificationService.submitActivity(req.user.id, data);
  }

  @Get('pending-activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN) // Chỉ Admin/Moderator mới được xem
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách hoạt động chờ duyệt (Dành cho Moderator)' })
  async getPending() {
    return this.gamificationService.getPendingActivities();
  }
}
