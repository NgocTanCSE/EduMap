import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummerCampaign } from './entities/summer.entity';
import { SummerCampaignService } from './summer.service';
import { SummerCampaignController } from './summer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SummerCampaign])],
  providers: [SummerCampaignService],
  controllers: [SummerCampaignController],
  exports: [SummerCampaignService],
})
export class SummerCampaignModule {}
