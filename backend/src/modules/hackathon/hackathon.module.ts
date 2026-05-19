import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hackathon } from './entities/hackathon.entity';
import { HackathonTeam } from './entities/hackathon-team.entity';
import { HackathonService } from './hackathon.service';
import { HackathonController } from './hackathon.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hackathon, HackathonTeam])],
  providers: [HackathonService],
  controllers: [HackathonController],
  exports: [HackathonService],
})
export class HackathonModule {}
