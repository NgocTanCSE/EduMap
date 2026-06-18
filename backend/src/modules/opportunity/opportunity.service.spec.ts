import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OpportunityService } from './opportunity.service';
import { Opportunity } from './entities/opportunity.entity';
import { Repository } from 'typeorm';

describe('OpportunityService', () => {
  let service: OpportunityService;
  let repo: Repository<Opportunity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityService,
        {
          provide: getRepositoryToken(Opportunity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OpportunityService>(OpportunityService);
    repo = module.get<Repository<Opportunity>>(getRepositoryToken(Opportunity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOpportunities', () => {
    it('should return array of opportunities', async () => {
      const mockOpps = [
        { id: 'opp-1', title: 'STEM Scholarship', type: 'scholarship' },
        { id: 'opp-2', title: 'Internship at Google', type: 'internship' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockOpps as Opportunity[]);

      const result = await service.getOpportunities();

      expect(result).toEqual(mockOpps);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('createOpportunity', () => {
    it('should create new opportunity', async () => {
      const mockOpp = { id: 'opp-1', title: 'New Opportunity', type: 'scholarship' };
      jest.spyOn(repo, 'create').mockReturnValue(mockOpp as Opportunity);
      jest.spyOn(repo, 'save').mockResolvedValue(mockOpp as Opportunity);

      const result = await service.createOpportunity({
        title: 'New Opportunity',
        description: 'Opportunity description',
        type: 'scholarship',
        organization: 'Test Org',
        deadline: '2026-12-31',
      });

      expect(result).toEqual(mockOpp);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('getOpportunityById', () => {
    it('should return opportunity when found', async () => {
      const mockOpp = { id: 'opp-1', title: 'STEM Scholarship', type: 'scholarship' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockOpp as Opportunity);

      const result = await service.getOpportunityById('opp-1');

      expect(result).toEqual(mockOpp);
    });

    it('should throw error when opportunity not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getOpportunityById('nonexistent')).rejects.toThrow();
    });
  });
});
