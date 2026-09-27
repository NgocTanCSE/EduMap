import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StemLab } from './entities/stem.entity';
import { StemService } from './stem.service';
import { StemController } from './stem.controller';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([StemLab]), AIModule],
  providers: [StemService],
  controllers: [StemController],
  exports: [StemService],
})
export class StemModule {}
