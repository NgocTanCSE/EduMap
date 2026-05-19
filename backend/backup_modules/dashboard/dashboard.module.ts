import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { MapPoint } from '../map/entities/map-point.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, MapPoint])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
