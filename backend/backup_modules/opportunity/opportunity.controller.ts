import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpportunityService } from './opportunity.service';

@ApiTags('MOD-05: Student Opportunity Map')
@Controller('api/opportunities')
export class OpportunityController {
  constructor(private readonly oppService: OpportunityService) {}

  @Get()
  @ApiOperation({ summary: 'F-16: Hi?n th? cõ h?i (Th?c t?p, H?c b?ng) trên b?n ð?' })
  async getOpportunities(@Query('type') type?: string, @Query('field') field?: string, @Query('bounds') bounds?: string) {
    return this.oppService.getOpportunities(type, field, bounds);
  }
}

