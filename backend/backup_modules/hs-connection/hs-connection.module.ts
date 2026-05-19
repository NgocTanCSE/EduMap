import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniversityCounseling } from './entities/hs.entity';
import { HsConnectionService } from './hs-connection.service';
import { HsConnectionController } from './hs-connection.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UniversityCounseling])],
  providers: [HsConnectionService],
  controllers: [HsConnectionController],
})
export class HsConnectionModule {}
