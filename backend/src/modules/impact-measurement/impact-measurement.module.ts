import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { ImpactMeasurementService } from './impact-measurement.service';
import { ImpactMeasurementController } from './impact-measurement.controller';
import { AIModule } from '../ai/ai.module';
@Module({
    imports: [
        TypeOrmModule.forFeature([MapPoint]),
        AIModule,
    ],
    providers: [ImpactMeasurementService],
    controllers: [ImpactMeasurementController],
    exports: [ImpactMeasurementService],
})
export class ImpactMeasurementModule {
}
