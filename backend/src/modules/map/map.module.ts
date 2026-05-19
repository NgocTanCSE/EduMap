import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { MapPoint } from './entities/map-point.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint]),
  ],
  providers: [MapService],
  controllers: [MapController],
  exports: [MapService],
})
export class MapModule {}
