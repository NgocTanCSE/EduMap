import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

import { UserEvent } from '../analytics/entities/user-event.entity';
import { UserLearningHistory } from '../library/entities/user-learning-history.entity';
import { UserCareer } from '../career/entities/user-career.entity';
import { UserSkill } from '../career/entities/user-skill.entity';
import { Post, Comment } from '../community/entities/community.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { UserCertificate } from '../certificate/entities/user-certificate.entity';
import { AIModule } from '../ai/ai.module'; // Import AIModule

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, 
      UserEvent, 
      UserLearningHistory, 
      UserCareer, 
      UserSkill, 
      Post, 
      Comment, 
      Booking, 
      UserCertificate
    ]),
    AIModule // Add AIModule
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
