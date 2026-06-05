import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Internship } from './entities/internship.entity';
import { InternshipApplication } from './entities/application.entity';
import { InternshipService } from './internship.service';
import { InternshipController } from './internship.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Internship, InternshipApplication])],
  controllers: [InternshipController],
  providers: [InternshipService],
  exports: [InternshipService],
})
export class InternshipModule {}

