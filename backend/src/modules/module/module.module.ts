// backend/src/modules/module/module.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module as ModuleEntity } from './module.entity';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller'; // Import ModuleController

@Module({
  imports: [TypeOrmModule.forFeature([ModuleEntity])],
  providers: [ModuleService],
  exports: [ModuleService], // Export the service if other modules need to use it
  controllers: [ModuleController], // Add ModuleController here
})
export class ModuleModule {}
