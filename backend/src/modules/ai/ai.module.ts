import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { LearningMaterial } from '../library/entities/learning-material.entity';
import { Location } from '../map/entities/location.entity';

import { ChatHistory } from './entities/chat-history.entity';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([LearningMaterial, Location, ChatHistory]),
  ],
  providers: [AIService],
  controllers: [AIController],
  exports: [AIService],
})
export class AIModule {}
