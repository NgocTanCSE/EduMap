import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { GoogleAIService } from '../../services/google-ai.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint, Location]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [MapService, GoogleAIService],
  controllers: [MapController],
  exports: [MapService],
})
export class MapModule {}
