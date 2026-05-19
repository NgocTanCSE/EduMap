import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey, SurveyResponse } from './entities/survey.entity';
import { SurveyService } from './survey.service';
import { SurveyController } from './survey.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse])],
  providers: [SurveyService],
  controllers: [SurveyController],
})
export class SurveyModule {}
