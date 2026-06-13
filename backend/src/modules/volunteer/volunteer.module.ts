import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerActivity } from './entities/volunteer.entity';
import { VolunteerHours } from './entities/volunteer-hours.entity';
import { VolunteerService } from './volunteer.service';
import { VolunteerController } from './volunteer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerActivity, VolunteerHours])],
  providers: [VolunteerService],
  controllers: [VolunteerController],
  exports: [VolunteerService],
})
export class VolunteerModule {}
