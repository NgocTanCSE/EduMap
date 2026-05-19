import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';

@Injectable()
export class OpportunityService {
  constructor(
    @InjectRepository(Opportunity) private oppRepo: Repository<Opportunity>,
  ) {}

  // F-16: Hi?n th? cõ h?i trên map
  async getOpportunities(type?: string, field?: string, bounds?: string) {
    const qb = this.oppRepo.createQueryBuilder('opp');
    if (type) qb.andWhere('opp.category = :type', { type });
    // N?u có bound, x? l? b?ng PostGIS ST_MakeEnvelope
    return qb.getMany();
  }
}

