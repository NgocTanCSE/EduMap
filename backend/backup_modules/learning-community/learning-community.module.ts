import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningSpot } from './entities/learning-spot.entity';
import { LearningCommunityService } from './learning-community.service';
import { LearningCommunityController } from './learning-community.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LearningSpot])],
  providers: [LearningCommunityService],
  controllers: [LearningCommunityController],
})
export class LearningCommunityModule {}
