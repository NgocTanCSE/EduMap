// backend/src/modules/role/role.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role as RoleEntity } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller'; // Import RoleController

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity])],
  providers: [RoleService],
  exports: [RoleService], // Export the service if other modules need to use it
  controllers: [RoleController], // Add RoleController here
})
export class RoleModule {}
