import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentorService } from './mentor.service';
import { MentorController } from './mentor.controller';
import { Mentor, Booking } from './entities/mentor.entity';
import { MentorSession } from './entities/mentor-session.entity';
import { MentorRelationship } from './entities/mentor-relationship.entity';
import { User } from '../auth/entities/user.entity';
import { AIModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mentor, Booking, MentorSession, MentorRelationship, User]),
    AIModule,
    NotificationsModule
  ],
  providers: [MentorService],
  controllers: [MentorController],
  exports: [MentorService],
})
export class MentorModule {}
