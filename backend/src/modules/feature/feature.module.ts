// backend/src/modules/feature/feature.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature as FeatureEntity } from './feature.entity';
import { FeatureService } from './feature.service';
import { FeatureController } from './feature.controller'; // Import FeatureController

@Module({
  imports: [TypeOrmModule.forFeature([FeatureEntity])],
  providers: [FeatureService],
  exports: [FeatureService], // Export the service if other modules need to use it
  controllers: [FeatureController], // Add FeatureController here
})
export class FeatureModule {}
