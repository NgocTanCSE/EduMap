import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hackathon } from './entities/hackathon.entity';
import { HackathonService } from './hackathon.service';
import { HackathonController } from './hackathon.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hackathon])],
  providers: [HackathonService],
  controllers: [HackathonController],
})
export class HackathonModule {}
