import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { SurveyService } from './survey.service';
import { SurveyController } from './survey.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse])],
  providers: [SurveyService],
  controllers: [SurveyController],
  exports: [SurveyService],
})
export class SurveyModule {}
