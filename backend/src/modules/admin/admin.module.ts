import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../auth/entities/user.entity';
import { CrawlerModule } from '../crawler/crawler.module';
import { AuditLogModule } from '../audit-log/audit-log.service'; // Fix path or use direct service if not exported correctly
import { DonationCampaign } from '../donate/entities/donation.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Event } from '../events/entities/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, DonationCampaign, Scholarship, Event]),
    CrawlerModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
