import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mentor, Booking } from './entities/mentor.entity';
import { User } from '../auth/entities/user.entity';
import { MentorService } from './mentor.service';
import { MentorController } from './mentor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mentor, Booking, User])],
  providers: [MentorService],
  controllers: [MentorController],
  exports: [MentorService],
})
export class MentorModule {}
