import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) 
    private notifyRepo: Repository<Notification>,
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Gửi thông báo đa kênh (Real-time + DB)
   */
  async sendNotification(userId: string, title: string, body: string, channels: string[]) {
    let savedNotification = null;

    // 1. Lưu vào Database (In-app)
    if (channels.includes('in-app')) {
      const notification = this.notifyRepo.create({
        user_id: userId,
        title,
        body,
        channel: 'in_app',
        is_read: false
      });
      savedNotification = await this.notifyRepo.save(notification);

      // 2. Gửi Real-time qua Socket.io
      this.gateway.sendToUser(userId, {
        id: savedNotification.id,
        title,
        body,
        sent_at: savedNotification.sent_at
      });
    }

    // Giả lập các kênh khác
    const results = { in_app: !!savedNotification };
    if (channels.includes('push')) results['push'] = true;
    if (channels.includes('email')) results['email'] = true;

    return { success: true, delivered_channels: results };
  }

  async getInAppNotifications(userId: string) {
    return this.notifyRepo.find({ 
      where: { user_id: userId }, 
      order: { sent_at: 'DESC' },
      take: 20 
    });
  }

  async markAsRead(id: string) {
    return this.notifyRepo.update(id, { is_read: true, read_at: new Date() });
  }
}
