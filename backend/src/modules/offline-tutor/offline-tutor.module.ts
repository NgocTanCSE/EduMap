import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OfflineTutorController } from './offline-tutor.controller';
import { OfflineTutorService } from './offline-tutor.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [OfflineTutorController],
  providers: [OfflineTutorService],
  exports: [OfflineTutorService],
})
export class OfflineTutorModule {}
