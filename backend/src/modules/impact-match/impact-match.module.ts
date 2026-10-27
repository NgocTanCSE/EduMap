import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImpactMatchService } from './impact-match.service';
import { ImpactMatchController } from './impact-match.controller';
import { SponsorProfile } from './entities/sponsor-profile.entity';
import { SponsorNeed } from './entities/sponsor-need.entity';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SponsorProfile, SponsorNeed]),
    AIModule,
  ],
  providers: [ImpactMatchService],
  controllers: [ImpactMatchController],
  exports: [ImpactMatchService],
})
export class ImpactMatchModule {}
