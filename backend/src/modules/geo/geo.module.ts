import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { GeoVisionService } from './geo-vision.service';
import { GeoVisionController } from './geo-vision.controller';
import { MapPoint } from '../map/entities/map-point.entity';
import { Location } from '../map/entities/location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint, Location]),
    HttpModule.register({
      timeout: 8000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [GeoVisionService],
  controllers: [GeoVisionController],
  exports: [GeoVisionService],
})
export class GeoModule {}
