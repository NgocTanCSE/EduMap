import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { User } from '../auth/entities/user.entity';
import { GreenActivity } from './entities/green-activity.entity';
import { Badge, UserBadge, UserPoint } from './entities/gamification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, 
      GreenActivity, 
      Badge, 
      UserBadge, 
      UserPoint
    ]),
    HttpModule,
  ],
  providers: [GamificationService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}
