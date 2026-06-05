import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation, DonationCampaign } from './entities/donation.entity';
import { DonateService } from './donate.service';
import { DonateController } from './donate.controller';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Donation, DonationCampaign]),
    GamificationModule,
  ],
  providers: [DonateService],
  controllers: [DonateController],
  exports: [DonateService],
})
export class DonateModule {}
