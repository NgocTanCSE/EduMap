import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceMatchService } from './resource-exchange.service';
import { AIService } from '../ai/ai.service';
import { Resource, ResourceType, ResourceStatus } from './entities/resource.entity';
import { ResourceRequest, RequestUrgency, RequestStatus } from './entities/resource-request.entity';
import { ResourceMatch } from './entities/resource-match.entity';

/** Build a fresh mock SelectQueryBuilder with all chainable methods. */
function makeQb() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };
}

describe('ResourceMatchService', () => {
  let service: ResourceMatchService;
  let resourceRepo: jest.Mocked<Repository<Resource>>;
  let requestRepo: jest.Mocked<Repository<ResourceRequest>>;
  let matchRepo: jest.Mocked<Repository<ResourceMatch>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    resourceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Resource>>;
    requestRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ResourceRequest>>;
    matchRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ResourceMatch>>;
    aiService = {
      resourceExchangeMatchRank: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceMatchService,
        { provide: getRepositoryToken(Resource), useValue: resourceRepo },
        { provide: getRepositoryToken(ResourceRequest), useValue: requestRepo },
        { provide: getRepositoryToken(ResourceMatch), useValue: matchRepo },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<ResourceMatchService>(ResourceMatchService);
  });

  // ── getResources ─────────────────────────────────────────────────
  describe('getResources', () => {
    it('returns paginated available resources', async () => {
      const qb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      qb.getManyAndCount.mockResolvedValue([[{ id: 'r1', title: 'iPad' } as any], 1]);

      const result = await service.getResources({ limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(1);
    });
  });

  // ── matchResources: pre-filtering ──────────────────────────────────
  describe('matchResources pre-filter', () => {
    it('only keeps pairs where resource.type === request.need_type', async () => {
      const resQb = makeQb();
      const reqQb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(resQb);
      (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(reqQb);

      resQb.getMany.mockResolvedValue([
        {
          id: 'r1',
          type: 'device',
          title: 'iPad',
          condition: 4,
          location: 'Biên Hòa',
          lat: 10.95,
          lng: 106.84,
          available_from: '2026-10-27',
          cost: 0,
          is_verified: true,
          tags: [],
          description: '',
        } as any,
      ]);
      reqQb.getMany.mockResolvedValue([
        // need_type=device matches resource r1
        {
          id: 'req1',
          need_type: 'device',
          title: 'Cần iPad',
          urgency: 'high',
          location: 'Biên Hòa',
          lat: 10.94,
          lng: 106.85,
          deadline: null,
          preferred_min_condition: 3,
          tags: [],
          description: '',
        } as any,
        // need_type=book does NOT match resource r1 (type=device)
        {
          id: 'req2',
          need_type: 'book',
          title: 'Cần sách',
          urgency: 'low',
          location: 'Biên Hòa',
          lat: 10.94,
          lng: 106.85,
          deadline: null,
          preferred_min_condition: 0,
          tags: [],
          description: '',
        } as any,
      ]);

      aiService.resourceExchangeMatchRank.mockResolvedValue({
        ranked_matches: [
          {
            resource_id: 'r1',
            request_id: 'req1',
            match_score: 90,
            explanation: 'ok',
            match_reasons: ['a'],
            next_steps: ['b'],
            scheduled_pickup: null,
          },
        ],
        transport_plan: [],
        degraded: false,
        reason: null,
      });

      const result = await service.matchResources({});

      // Only req1 (device) qualifies → 1 pre-filtered pair sent to AI
      const aiPayload = (aiService.resourceExchangeMatchRank as jest.Mock).mock.calls[0][0];
      expect(aiPayload.pairs.length).toBe(1);
      expect(aiPayload.pairs[0].resource_id).toBe('r1');
      expect(aiPayload.pairs[0].request_id).toBe('req1');
      expect(result.pre_filter_summary.pre_filtered_pairs).toBe(1);
    });

    it('filters by region when provided (request location must match)', async () => {
      const resQb = makeQb();
      const reqQb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(resQb);
      (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(reqQb);

      resQb.getMany.mockResolvedValue([
        {
          id: 'r1',
          type: 'device',
          title: 'iPad',
          condition: 4,
          location: 'Biên Hòa',
          lat: 10.95,
          lng: 106.84,
          available_from: '2026-10-27',
          cost: 0,
          is_verified: true,
          tags: [],
          description: '',
        } as any,
      ]);
      reqQb.getMany.mockResolvedValue([
        {
          id: 'req1',
          need_type: 'device',
          title: 'Cần',
          urgency: 'high',
          location: 'Biên Hòa, Đồng Nai',
          lat: 10.94,
          lng: 106.85,
          deadline: null,
          preferred_min_condition: 3,
          tags: [],
          description: '',
        } as any,
        {
          id: 'req2',
          need_type: 'device',
          title: 'Cần 2',
          urgency: 'low',
          location: 'Hà Nội',
          lat: 21.02,
          lng: 105.83,
          deadline: null,
          preferred_min_condition: 3,
          tags: [],
          description: '',
        } as any,
      ]);

      aiService.resourceExchangeMatchRank.mockResolvedValue({
        ranked_matches: [],
        transport_plan: [],
        degraded: false,
        reason: null,
      });

      await service.matchResources({ region: 'Đồng Nai' });

      const aiPayload = (aiService.resourceExchangeMatchRank as jest.Mock).mock.calls[0][0];
      // Only req1 (Đồng Nai) passes the region filter
      expect(aiPayload.pairs.every((p: any) => p.request_id === 'req1')).toBe(true);
      expect(aiPayload.pairs.length).toBe(1);
    });

    it('caps pairs at 15 to avoid token overflow', async () => {
      const resQb = makeQb();
      const reqQb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(resQb);
      (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(reqQb);

      const resources = Array.from(
        { length: 10 },
        (_, i) =>
          ({
            id: `r${i}`,
            type: 'device',
            title: `Dev ${i}`,
            condition: 5,
            location: '',
            lat: 10,
            lng: 106,
            available_from: '2026-10-27',
            cost: 0,
            is_verified: true,
            tags: [],
            description: '',
          }) as any,
      );
      const requests = Array.from(
        { length: 10 },
        (_, i) =>
          ({
            id: `req${i}`,
            need_type: 'device',
            title: `Req ${i}`,
            urgency: 'medium',
            location: '',
            lat: 10,
            lng: 106,
            deadline: null,
            preferred_min_condition: 0,
            tags: [],
            description: '',
          }) as any,
      );
      resQb.getMany.mockResolvedValue(resources);
      reqQb.getMany.mockResolvedValue(requests);
      aiService.resourceExchangeMatchRank.mockResolvedValue({
        ranked_matches: [],
        transport_plan: [],
        degraded: false,
        reason: null,
      });

      await service.matchResources({});
      expect(aiService.resourceExchangeMatchRank).toHaveBeenCalled();
      const aiPayload = (aiService.resourceExchangeMatchRank as jest.Mock).mock.calls[0][0];
      // 10×10 = 100 candidate pairs, capped at 15
      expect(aiPayload.pairs.length).toBe(15);
    });

    it('returns empty results without calling AI when no candidate pairs', async () => {
      const resQb = makeQb();
      const reqQb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(resQb);
      (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(reqQb);
      resQb.getMany.mockResolvedValue([]);
      reqQb.getMany.mockResolvedValue([]);

      const result = await service.matchResources({});
      expect(result.ranked_matches).toEqual([]);
      expect(result.pre_filter_summary.pre_filtered_pairs).toBe(0);
      expect(aiService.resourceExchangeMatchRank).not.toHaveBeenCalled();
    });
  });

  // ── matchResources: graceful degradation ───────────────────────────
  describe('matchResources graceful degradation', () => {
    it('returns degraded results with SQLite scores when AI throws', async () => {
      const resQb = makeQb();
      const reqQb = makeQb();
      (resourceRepo.createQueryBuilder as jest.Mock).mockReturnValue(resQb);
      (requestRepo.createQueryBuilder as jest.Mock).mockReturnValue(reqQb);

      resQb.getMany.mockResolvedValue([
        {
          id: 'r1',
          type: 'device',
          title: 'iPad',
          condition: 5,
          location: 'Biên Hòa',
          lat: 10.95,
          lng: 106.84,
          available_from: '2026-10-27',
          cost: 0,
          is_verified: true,
          tags: [],
          description: '',
        } as any,
      ]);
      reqQb.getMany.mockResolvedValue([
        {
          id: 'req1',
          need_type: 'device',
          title: 'Cần iPad',
          urgency: 'high',
          location: 'Biên Hòa',
          lat: 10.94,
          lng: 106.85,
          deadline: null,
          preferred_min_condition: 3,
          tags: [],
          description: '',
        } as any,
      ]);

      (aiService.resourceExchangeMatchRank as jest.Mock).mockRejectedValue(
        new Error('AI Service unavailable'),
      );

      const result = await service.matchResources({});
      expect(result.degraded).toBe(true);
      expect(result.reason).toContain('AI Service unavailable');
      // Still returns the SQLite-scored pair so the UI is never empty
      expect(result.ranked_matches.length).toBe(1);
      expect(result.ranked_matches[0].resource_id).toBe('r1');
    });
  });

  // ── getResourceById / getResourceRequestById ──────────────────────
  describe('getById (not found)', () => {
    it('throws NotFoundException for missing resource', async () => {
      resourceRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.getResourceById('nope')).rejects.toThrow();
    });
    it('throws NotFoundException for missing request', async () => {
      requestRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.getResourceRequestById('nope')).rejects.toThrow();
    });
  });
});
