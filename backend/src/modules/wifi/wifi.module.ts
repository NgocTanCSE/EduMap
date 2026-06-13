import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WifiLocation } from './entities/wifi.entity';
import { WifiConnection } from './entities/wifi-connection.entity';
import { WifiService } from './wifi.service';
import { WifiController } from './wifi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WifiLocation, WifiConnection])],
  providers: [WifiService],
  controllers: [WifiController],
  exports: [WifiService],
})
export class WifiModule {}
