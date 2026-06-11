import { Injectable } from '@nestjs/common';

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
  private notifications: Notification[] = []; // In-memory mock data
  private nextId = 1;

  async sendNotification(userId: string, message: string, type: 'email' | 'in-app' | 'push'): Promise<Notification> {
    // Simulate sending a notification; map message to title, leave body empty
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
    this.notifications.push(newNotification);
    console.log(`Mock: Sent ${type} notification to user ${userId}: "${message}"`);
    return newNotification;
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    // Filter notifications for a given user
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
