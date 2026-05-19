import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StemLab } from './entities/stem.entity';
import { StemService } from './stem.service';
import { StemController } from './stem.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StemLab])],
  providers: [StemService],
  controllers: [StemController],
})
export class StemModule {}
