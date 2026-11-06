import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { memoryStore } from 'cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { AIModule } from './modules/ai/ai.module';
import { OfflineTutorModule } from './modules/offline-tutor/offline-tutor.module';
import { MapModule } from './modules/map/map.module';
import { LibraryModule } from './modules/library/library.module';
import { StorageModule } from './modules/storage/storage.module';
import { CrawlerModule } from './modules/crawler/crawler.module';
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
import { SummerModule } from './modules/summer/summer.module';
import { HsConnectionModule } from './modules/hs-connection/hs-connection.module';
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
import { RoleModule } from './modules/role/role.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PinModule } from './modules/pin/pin.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { ImpactMatchModule } from './modules/impact-match/impact-match.module';
import { ImpactMeasurementModule } from './modules/impact-measurement/impact-measurement.module';
import { GeoModule } from './modules/geo/geo.module';
import { ResourceExchangeModule } from './modules/resource-exchange/resource-exchange.module';
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        CacheModule.registerAsync({
            isGlobal: true,
            useFactory: async () => {
                if (!process.env.REDIS_HOST) {
                    console.log('[CacheModule] SQLite/HF Spaces mode — using in-memory cache (Redis disabled)');
                    return { store: memoryStore(), ttl: 300 } as any;
                }
                try {
                    return {
                        store: await redisStore({
                            socket: {
                                host: process.env.REDIS_HOST || 'localhost',
                                port: Number(process.env.REDIS_PORT) || 6379,
                            },
                        }),
                    } as any;
                }
                catch (err) {
                    console.warn('[CacheModule] Redis unavailable — falling back to in-memory cache. Reason:', (err as Error).message);
                    return { store: memoryStore() } as any;
                }
            },
        }),
        ...(process.env.REDIS_HOST
            ? [BullModule.forRoot({
                    redis: {
                        host: process.env.REDIS_HOST,
                        port: Number(process.env.REDIS_PORT) || 6379,
                    },
                })]
            : []),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || ((process.env.DB_HOST || '').includes('supabase') ? 6543 : 5432),
            username: process.env.DB_USERNAME || 'admin',
            password: process.env.DB_PASSWORD
                ? process.env.DB_PASSWORD
                : process.env.NODE_ENV === 'production'
                    ? (() => {
                        throw new Error('DB_PASSWORD environment variable is required in production.');
                    })()
                    : 'password123',
            database: process.env.DB_DATABASE || 'edumap_db',
            ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
                ? ({ rejectUnauthorized: false, servername: process.env.DB_HOST } as any)
                : false,
            entities: [__dirname + '*.entity{.ts,.js}'],
            migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
            migrationsRun: false,
            synchronize: process.env.DB_SYNC === 'true',
        }),
        HttpModule,
        MailerModule.forRoot({
            transport: {
                host: process.env.MAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.MAIL_PORT) || 587,
                secure: false,
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASS,
                },
            },
            defaults: {
                from: '"EduMap Support" <support@edumap.vn>',
            },
            template: {
                dir: join(__dirname, 'modules/notifications/templates'),
                adapter: new HandlebarsAdapter(),
                options: {
                    strict: true,
                },
            },
        }),
        AuthModule,
        AIModule,
        OfflineTutorModule,
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
        SummerModule,
        HsConnectionModule,
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
        RoleModule,
        CrawlerModule,
        AnalyticsModule,
        PaymentModule,
        PinModule,
        BookmarksModule,
        ImpactMatchModule,
        ImpactMeasurementModule,
        GeoModule,
        ResourceExchangeModule,
    ],
    controllers: [
        HealthController,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
