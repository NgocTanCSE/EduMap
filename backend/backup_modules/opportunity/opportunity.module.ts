import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { OpportunityService } from './opportunity.service';
import { OpportunityController } from './opportunity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Opportunity])],
  providers: [OpportunityService],
  controllers: [OpportunityController],
})
export class OpportunityModule {}
