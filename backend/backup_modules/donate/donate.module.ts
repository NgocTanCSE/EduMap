import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Donation, DonationCampaign } from './entities/donate.entity';
import { DonateService } from './donate.service';
import { DonateController } from './donate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Donation, DonationCampaign])],
  providers: [DonateService],
  controllers: [DonateController],
})
export class DonateModule {}
