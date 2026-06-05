import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CrawlerService } from './crawler.service';
import { MapPoint } from '../map/entities/map-point.entity';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint]),
    HttpModule,
    AIModule,
  ],
  providers: [CrawlerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
