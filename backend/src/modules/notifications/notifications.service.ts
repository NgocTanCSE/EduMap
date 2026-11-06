import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification } from './entities/notification.entity';
export interface NotificationView {
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
    constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>, private readonly mailerService: MailerService) { }
    private toView(row: Notification): NotificationView {
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            body: row.body || '',
            channel: (row.channel as any) || 'in-app',
            is_read: row.is_read,
            sent_at: row.sent_at ? row.sent_at.toISOString() : new Date().toISOString(),
            read_at: row.read_at ? row.read_at.toISOString() : null,
        };
    }
    async sendNotification(userId: string, message: string, type: 'email' | 'in-app' | 'push', emailAddress?: string): Promise<NotificationView> {
        const row = this.notificationRepo.create({
            user_id: userId,
            title: message,
            body: '',
            channel: type,
            is_read: false,
        });
        const saved = await this.notificationRepo.save(row);
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
            }
            catch (error: any) {
                this.logger.error(`Failed to send email to ${emailAddress}: ${error.message}`);
            }
        }
        this.logger.log(`Sent ${type} notification to user ${userId}: "${message}"`);
        return this.toView(saved);
    }
    async getNotificationsForUser(userId: string): Promise<NotificationView[]> {
        const rows = await this.notificationRepo.find({
            where: { user_id: userId },
            order: { sent_at: 'DESC' },
        });
        return rows.map((row) => this.toView(row));
    }
    async markAsRead(id: string): Promise<NotificationView> {
        const row = await this.notificationRepo.findOne({ where: { id } });
        if (!row)
            throw new Error('Notification not found');
        row.is_read = true;
        row.read_at = new Date();
        const saved = await this.notificationRepo.save(row);
        return this.toView(saved);
    }
    async isNotificationOwner(id: string, userId: string): Promise<boolean> {
        const row = await this.notificationRepo.findOne({ where: { id } });
        return !!row && row.user_id === userId;
    }
}
