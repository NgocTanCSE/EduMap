import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GreenService } from './green.service';
import { GreenController } from './green.controller';
import { GreenChallenge, GreenChallengeActivity } from './entities/green.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GreenChallenge, GreenChallengeActivity]),
  ],
  providers: [GreenService],
  controllers: [GreenController],
  exports: [GreenService],
})
export class GreenModule {}
