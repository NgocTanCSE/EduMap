import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { User } from '../auth/entities/user.entity';
import { CrawlerModule } from '../crawler/crawler.module';
import { AIModule } from '../ai/ai.module';
import { DonationCampaign } from '../donate/entities/donation.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Event } from '../events/entities/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, DonationCampaign, Scholarship, Event]),
    CrawlerModule,
    AIModule,
  ],
  providers: [AdminService, BackupService],
  controllers: [AdminController],
  exports: [AdminService, BackupService],
})
export class AdminModule {}
