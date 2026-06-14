import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: 'email' | 'in-app' | 'push';
  is_read: boolean;
  sent_at: string;
  read_at?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private notifications: Notification[] = [];
  private nextId = 1;

  constructor(private readonly mailerService: MailerService) {}

  async sendNotification(
    userId: string, 
    message: string, 
    type: 'email' | 'in-app' | 'push',
    emailAddress?: string
  ): Promise<Notification> {
    const newNotification: Notification = {
      id: `notif${this.nextId++}`,
      userId,
      title: message,
      body: '',
      channel: type,
      is_read: false,
      sent_at: new Date().toISOString(),
      read_at: null,
    };

    if (type === 'email' && emailAddress) {
      try {
        await this.mailerService.sendMail({
          to: emailAddress,
          subject: 'Thông báo từ EduMap',
          template: './notification',
          context: {
            message: message,
            action_url: 'https://edumap.vn/notifications',
          },
        });
        this.logger.log(`Email sent successfully to ${emailAddress}`);
      } catch (error) {
        this.logger.error(`Failed to send email to ${emailAddress}: ${error.message}`);
      }
    }

    this.notifications.push(newNotification);
    this.logger.log(`Sent ${type} notification to user ${userId}: "${message}"`);
    return newNotification;
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return this.notifications.filter(notif => notif.userId === userId);
  }

  async markAsRead(id: string): Promise<Notification> {
    const notif = this.notifications.find(n => n.id === id);
    if (!notif) throw new Error('Notification not found');
    notif.is_read = true;
    notif.read_at = new Date().toISOString();
    return notif;
  }
}
