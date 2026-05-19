import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GreenChallenge, GreenChallengeActivity } from './entities/green.entity';
import { GreenCampusService } from './green.service';
import { GreenController } from './green.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GreenChallenge, GreenChallengeActivity])],
  providers: [GreenCampusService],
  controllers: [GreenController],
  exports: [GreenCampusService],
})
export class GreenModule {}
