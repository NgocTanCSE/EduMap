import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';
import { CareerPath } from './entities/career.entity';
import { Job } from './entities/job.entity';
import { UserCareer } from './entities/user-career.entity';
import { UserSkill } from './entities/user-skill.entity';
import { Application } from './entities/application.entity';
import { User } from '../auth/entities/user.entity';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
@Module({
    imports: [
        TypeOrmModule.forFeature([CareerPath, Job, UserCareer, UserSkill, Application, User]),
        AIModule,
        StorageModule,
    ],
    providers: [CareerService],
    controllers: [CareerController],
})
export class CareerModule {
}
