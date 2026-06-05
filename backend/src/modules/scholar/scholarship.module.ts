import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scholarship } from './entities/scholarship.entity';
import { ScholarshipApplication } from './entities/scholarship-application.entity';
import { User } from '../auth/entities/user.entity';
import { ScholarshipService } from './scholarship.service';
import { ScholarshipController } from './scholarship.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scholarship, ScholarshipApplication, User]),
    NotificationsModule,
    AIModule
  ],
  providers: [ScholarshipService],
  controllers: [ScholarshipController],
  exports: [ScholarshipService],
})
export class ScholarshipModule {}
