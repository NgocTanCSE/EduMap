import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';
import { CareerPath } from './entities/career.entity';
import { Job } from './entities/job.entity'; // New import
import { UserCareer } from './entities/user-career.entity'; // New import
import { UserSkill } from './entities/user-skill.entity'; // New import
import { Application } from './entities/application.entity'; // New import
import { User } from '../auth/entities/user.entity'; // Import User entity
import { AIModule } from '../ai/ai.module'; // Import AI module
import { StorageModule } from '../storage/storage.module'; // New import

@Module({
  imports: [
    TypeOrmModule.forFeature([CareerPath, Job, UserCareer, UserSkill, Application, User]),
    AIModule,
    StorageModule, // Add StorageModule
  ],
  providers: [CareerService],
  controllers: [CareerController],
})
export class CareerModule {}
