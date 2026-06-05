import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { Location } from './entities/location.entity';
import { LocationCategory } from './entities/location-category.entity';
import { AIModule } from '../ai/ai.module'; // Correct path to AIModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, LocationCategory]),
    AIModule,
  ],
  providers: [MapService],
  controllers: [MapController],
  exports: [MapService],
})
export class MapModule {}
