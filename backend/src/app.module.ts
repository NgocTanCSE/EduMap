import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { redisStore } from 'cache-manager-redis-yet';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// === CORE MODULES ===
import { AuthModule } from './modules/auth/auth.module';
import { AIModule } from './modules/ai/ai.module';
import { MapModule } from './modules/map/map.module';
import { LibraryModule } from './modules/library/library.module';
import { StorageModule } from './modules/storage/storage.module';
import { CrawlerModule } from './modules/crawler/crawler.module';

// === RESTORED MODULES ===
import { GamificationModule } from './modules/gamification/gamification.module';
import { GreenModule } from './modules/green/green.module';
import { ScholarshipModule } from './modules/scholar/scholarship.module';
import { VolunteerModule } from './modules/volunteer/volunteer.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EventsModule } from './modules/events/events.module';
import { DonateModule } from './modules/donate/donate.module';
import { CommunityModule } from './modules/community/community.module';
import { InternshipModule } from './modules/internship/internship.module';
import { BusinessModule } from './modules/business/business.module';
import { StemModule } from './modules/stem/stem.module';
import { SurveyModule } from './modules/survey/survey.module';
import { WifiModule } from './modules/wifi/wifi.module';
import { SummerCampaignModule } from './modules/summer/summer.module';
import { HsConnectionModule } from './modules/hs-connection/hs-connection.module';
import { MobileConfigModule } from './modules/mobile-config/mobile-config.module';
import { CareerModule } from './modules/career/career.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { OpportunityModule } from './modules/opportunity/opportunity.module';
import { ShareModule } from './modules/share/share.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { LearningCommunityModule } from './modules/learning-community/learning-community.module';
import { HackathonModule } from './modules/hackathon/hackathon.module';
import { IntlModule } from './modules/intl/intl.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ModuleModule } from './modules/module/module.module'; // Import new ModuleModule
import { FeatureModule } from './modules/feature/feature.module'; // Import new FeatureModule
import { RoleModule } from './modules/role/role.module'; // Import new RoleModule
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
        }),
      }),
    }),
    BullModule.forRoot({
      redis: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'password123',
      database: process.env.DB_DATABASE || 'edumap_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // Quản lý qua Migrations
    }),
    HttpModule,
    AuthModule,
    AIModule,
    MapModule,
    LibraryModule,
    StorageModule,
    GamificationModule,
    GreenModule,
    ScholarshipModule,
    VolunteerModule,
    NotificationsModule,
    EventsModule,
    DonateModule,
    CommunityModule,
    InternshipModule,
    BusinessModule,
    StemModule,
    SurveyModule,
    WifiModule,
    SummerCampaignModule,
    HsConnectionModule,
    MobileConfigModule,
    CareerModule,
    DashboardModule,
    MentorModule,
    OpportunityModule,
    ShareModule,
    CertificateModule,
    LearningCommunityModule,
    HackathonModule,
    IntlModule,
    AdminModule,
    AuditLogModule,
    ModuleModule, // Add ModuleModule here
    FeatureModule, // Add FeatureModule here
    RoleModule, // Add RoleModule here
    CrawlerModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

