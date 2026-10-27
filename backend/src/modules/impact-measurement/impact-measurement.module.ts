import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { ImpactMeasurementService } from './impact-measurement.service';
import { ImpactMeasurementController } from './impact-measurement.controller';
import { AIModule } from '../ai/ai.module';

/**
 * Idea #19: AI Impact Measurement.
 *
 * Provides the backend before/after diff (T1) from `map_points` and the proxy
 * to the ai-service (T2) for trend analysis / confidence interval / impact
 * score. Mirrors ImpactMatchModule's wiring: TypeOrm for the data entity
 * (MapPoint) + AIModule so we can inject AIService for the ai-service proxy.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MapPoint]),
    AIModule,
  ],
  providers: [ImpactMeasurementService],
  controllers: [ImpactMeasurementController],
  exports: [ImpactMeasurementService],
})
export class ImpactMeasurementModule {}
