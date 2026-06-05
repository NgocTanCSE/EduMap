import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummerCampaign } from './entities/summer.entity';
import { SummerRegistration } from './entities/summer-registration.entity';
import { SummerCampaignService } from './summer.service';
import { SummerCampaignController } from './summer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SummerCampaign, SummerRegistration])],
  controllers: [SummerCampaignController],
  providers: [SummerCampaignService],
  exports: [SummerCampaignService],
})
export class SummerModule {}

