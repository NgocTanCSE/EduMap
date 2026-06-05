import { Controller, Post, Get, Body, Param, InternalServerErrorException, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

interface SendNotificationDto {
  userId: string;
  message: string;
  type: 'email' | 'in-app' | 'push';
}

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
}
