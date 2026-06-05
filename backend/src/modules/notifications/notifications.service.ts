import { Injectable } from '@nestjs/common';

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'email' | 'in-app' | 'push';
  status: 'sent' | 'failed' | 'pending';
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private notifications: Notification[] = []; // In-memory mock data
  private nextId = 1;

  async sendNotification(userId: string, message: string, type: 'email' | 'in-app' | 'push'): Promise<Notification> {
    // Simulate sending a notification
    const newNotification: Notification = {
      id: `notif${this.nextId++}`,
      userId,
      message,
      type,
      status: 'sent', // Assume success for mock
      timestamp: new Date().toISOString(),
    };
    this.notifications.push(newNotification);
    console.log(`Mock: Sent ${type} notification to user ${userId}: "${message}"`);
    // In a real app, this would integrate with a notification provider (e.g., SendGrid, Firebase)
    return newNotification;
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    // In a real app, this would fetch from a database
    return this.notifications.filter(notif => notif.userId === userId);
  }
}
