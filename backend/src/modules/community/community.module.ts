import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post, Comment, Group, ChatMessage } from './entities/community.entity';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { AIModule } from '../ai/ai.module'; // Import AIModule
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Comment, Group, ChatMessage]),
    AIModule,
    NotificationsModule,
  ],
  providers: [CommunityService],
  controllers: [CommunityController],
  exports: [CommunityService],
})
export class CommunityModule {}
