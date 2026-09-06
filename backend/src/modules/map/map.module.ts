import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { FloodRoutingService } from './flood-routing.service';
import { TrafficRoutingService } from './traffic-routing.service';
import { GoogleAIService } from '../../services/google-ai.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';
import { FloodZone } from './entities/flood-zone.entity';
import { TrafficSegment } from './entities/traffic-segment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint, Location, FloodZone, TrafficSegment]),
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [MapService, RoutingService, FloodRoutingService, TrafficRoutingService, GoogleAIService],
  controllers: [MapController, RoutingController],
  exports: [MapService, RoutingService, FloodRoutingService, TrafficRoutingService],
})
export class MapModule {}
