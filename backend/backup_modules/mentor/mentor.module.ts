import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mentor, Booking } from './entities/mentor.entity';
import { MentorService } from './mentor.service';
import { MentorController } from './mentor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mentor, Booking])],
  providers: [MentorService],
  controllers: [MentorController],
})
export class MentorModule {}
