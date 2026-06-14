import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserEvent } from './entities/user-event.entity';
import { EducationStat } from './entities/education-stat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEvent, EducationStat])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
