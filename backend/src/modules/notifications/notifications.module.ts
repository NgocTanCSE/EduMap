import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationGateway } from './notification.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
@Module({
    imports: [TypeOrmModule.forFeature([Notification])],
    providers: [NotificationsService, NotificationGateway],
    controllers: [NotificationsController],
    exports: [NotificationsService],
})
export class NotificationsModule {
}
