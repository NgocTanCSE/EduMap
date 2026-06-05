import { Module } from '@nestjs/common';
import { MapService } from './map.service';
import { MapController } from './map.controller';

@Module({
  providers: [MapService],
  controllers: [MapController],
  exports: [MapService],
})
export class MapModule {}
