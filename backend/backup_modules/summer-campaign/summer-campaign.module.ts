import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SummerCampaign } from './entities/summer.entity';
@Module({ imports: [TypeOrmModule.forFeature([SummerCampaign])] }) export class SummerCampaignModule {}
