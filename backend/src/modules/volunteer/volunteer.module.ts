import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerActivity } from './entities/volunteer.entity';
import { VolunteerService } from './volunteer.service';
import { VolunteerController } from './volunteer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerActivity])],
  providers: [VolunteerService],
  controllers: [VolunteerController],
  exports: [VolunteerService],
})
export class VolunteerModule {}
