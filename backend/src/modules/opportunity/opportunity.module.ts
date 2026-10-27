import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { OpportunityService } from './opportunity.service';
import { OpportunityMatchingService } from './opportunity-matching.service';
import { OpportunityController } from './opportunity.controller';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Job } from '../career/entities/job.entity';
import { User } from '../auth/entities/user.entity';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Opportunity, Scholarship, Job, User]),
    AIModule,
  ],
  providers: [OpportunityService, OpportunityMatchingService],
  controllers: [OpportunityController],
  exports: [OpportunityService, OpportunityMatchingService],
})
export class OpportunityModule {}
