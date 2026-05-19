import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerPath } from './entities/career.entity';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CareerPath])],
  providers: [CareerService],
  controllers: [CareerController],
  exports: [CareerService],
})
export class CareerModule {}
