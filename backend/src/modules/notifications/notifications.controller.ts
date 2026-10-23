import { Controller, Post, Get, Put, Body, Param, Request, UseGuards, InternalServerErrorException, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../auth/entities/user.entity';

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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error(`Error getting notifications for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve notifications');
    }
  }

  // Admin-style endpoint — requires admin role to view other users' notifications.
  @Get(':userId')
  async getNotificationsForUser(@Param('userId') userId: string, @Request() req) {
    // Ownership check: non-admins can only view their own notifications.
    const requesterId = req.user?.id || req.user?.sub;
    const requesterRole = req.user?.role;
    if (requesterId !== userId && requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Bạn không có quyền truy cập thông báo của người dùng khác.');
    }
    try {
      const notifications = await this.notificationsService.getNotificationsForUser(userId);
      return { success: true, data: notifications };
    } catch (error: any) {
      console.error(`Error getting notifications for user ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve notifications');
    }
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    // Ownership verification: only the notification owner or admin can mark as read.
    const requesterId = req.user?.id || req.user?.sub;
    const requesterRole = req.user?.role;
    const isOwner = await this.notificationsService.isNotificationOwner(id, requesterId);
    if (!isOwner && requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Bạn không có quyền cập nhật thông báo của người dùng khác.');
    }
    try {
      const updated = await this.notificationsService.markAsRead(id);
      return { success: true, data: updated };
    } catch (error: any) {
      console.error(`Error marking notification ${id} as read: ${error.message}`);
      throw new InternalServerErrorException('Failed to update notification');
    }
  }
}
