import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Internship } from './entities/internship.entity';
import { InternshipService } from './internship.service';
import { InternshipController } from './internship.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Internship])],
  providers: [InternshipService],
  controllers: [InternshipController],
})
export class InternshipModule {}
