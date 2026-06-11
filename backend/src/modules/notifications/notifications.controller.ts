import { Controller, Post, Get, Put, Body, Param, Request, UseGuards, InternalServerErrorException, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface SendNotificationDto {
  userId: string;
  message: string;
  type: 'email' | 'in-app' | 'push';
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendNotification(@Body() sendNotificationDto: SendNotificationDto) {
    try {
      const notification = await this.notificationsService.sendNotification(
        sendNotificationDto.userId,
        sendNotificationDto.message,
        sendNotificationDto.type,
      );
      return { success: true, data: notification };
    } catch (error) {
      console.error(`Error sending notification: ${error.message}`);
      throw new InternalServerErrorException('Failed to send notification');
    }
  }

  // Get notifications for the logged‑in user (used by frontend)
  @Get()
  async getMyNotifications(@Request() req) {
    const userId = req.user.id;
    try {
      const notifications = await this.notificationsService.getNotificationsForUser(userId);
      const unreadCount = notifications.filter(n => !n.is_read).length;
      return { success: true, notifications, unread_count: unreadCount };
    } catch (error) {
      console.error(`Error getting notifications for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve notifications');
    }
  }

  // Existing admin‑style endpoint – kept for compatibility
  @Get(':userId')
  async getNotificationsForUser(@Param('userId') userId: string) {
    try {
      const notifications = await this.notificationsService.getNotificationsForUser(userId);
      return { success: true, data: notifications };
    } catch (error) {
      console.error(`Error getting notifications for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve notifications');
    }
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    // Optional: Verify ownership (skip for mock)
    try {
      const updated = await this.notificationsService.markAsRead(id);
      return { success: true, data: updated };
    } catch (error) {
      console.error(`Error marking notification ${id} as read: ${error.message}`);
      throw new InternalServerErrorException('Failed to update notification');
    }
  }
}
