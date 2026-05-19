import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WifiLocation } from './entities/wifi.entity';
import { WifiService } from './wifi.service';
import { WifiController } from './wifi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WifiLocation])],
  providers: [WifiService],
  controllers: [WifiController],
  exports: [WifiService],
})
export class WifiModule {}
