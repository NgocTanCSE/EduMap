import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobileUnit, MobileUnitRoute } from './entities/mobile.entity';
import { MobileConfigService } from './mobile-config.service';
import { MobileConfigController } from './mobile-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MobileUnit, MobileUnitRoute])],
  providers: [MobileConfigService],
  controllers: [MobileConfigController],
})
export class MobileConfigModule {}
