import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningSpot } from './entities/learning-spot.entity';
import { LearningCommunityService } from './learning-community.service';
import { LearningCommunityController } from './learning-community.controller';
import { LearningSpaceRecommenderService } from './learning-space-recommender.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningSpot]),
    AIModule,
  ],
  providers: [LearningCommunityService, LearningSpaceRecommenderService],
  controllers: [LearningCommunityController],
  exports: [LearningCommunityService, LearningSpaceRecommenderService],
})
export class LearningCommunityModule {}
