import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../map/entities/location.entity';
import { WifiService } from './wifi.service';
import { WifiController } from './wifi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Location])],
  providers: [WifiService],
  controllers: [WifiController],
  exports: [WifiService],
})
export class WifiModule {}
