import { Controller, Get, Put, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của tôi' })
  async getMyNotifications(@Request() req) {
    const userId = req.user.id;
    const list = await this.notificationsService.getInAppNotifications(userId);
    const unreadCount = list.filter(n => !n.is_read).length;
    return {
      notifications: list,
      unread_count: unreadCount
    };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  async markAsRead(@Param('id') id: string) {
    await this.notificationsService.markAsRead(id);
    return { id, is_read: true, message: 'Đã đọc thông báo' };
  }
}
