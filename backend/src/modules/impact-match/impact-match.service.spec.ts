import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImpactMatchService } from './impact-match.service';
import { AIService } from '../ai/ai.service';
import { SponsorProfile } from './entities/sponsor-profile.entity';
import { SponsorNeed, NeedStatus, NeedUrgency } from './entities/sponsor-need.entity';
import { ImpactMatchRankDto } from './dto/impact-match-rank.dto';

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

describe('ImpactMatchService', () => {
  let service: ImpactMatchService;
  let needRepo: jest.Mocked<Repository<SponsorNeed>>;
  let sponsorRepo: jest.Mocked<Repository<SponsorProfile>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    needRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<SponsorNeed>>;

    sponsorRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<SponsorProfile>>;

    aiService = {
      impactMatchRank: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactMatchService,
        { provide: getRepositoryToken(SponsorNeed), useValue: needRepo },
        { provide: getRepositoryToken(SponsorProfile), useValue: sponsorRepo },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<ImpactMatchService>(ImpactMatchService);
  });

  // ── getSponsorNeeds ────────────────────────────────────────────────
  describe('getSponsorNeeds', () => {
    it('returns paginated needs', async () => {
      const qb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      qb.getManyAndCount.mockResolvedValue([
        [{ id: 'n1', title: 'Test Need' } as any], 1,
      ]);

      const result = await service.getSponsorNeeds({});
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
    });

    it('caps limit at 50', async () => {
      const qb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.getSponsorNeeds({ limit: 999, page: 1 });
      expect(result.meta.limit).toBe(50);
    });

    it('floor page at 1', async () => {
      const qb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.getSponsorNeeds({ page: -5 });
      expect(result.meta.page).toBe(1);
    });
  });

  // ── getSponsorProfiles ─────────────────────────────────────────────
  describe('getSponsorProfiles', () => {
    it('returns paginated sponsors', async () => {
      const qb = makeQb();
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      qb.getManyAndCount.mockResolvedValue([
        [{ id: 's1', name: 'Test Sponsor' } as any], 1,
      ]);

      const result = await service.getSponsorProfiles({});
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.meta.page).toBe(1);
    });
  });

  // ── createSponsorNeed ──────────────────────────────────────────────
  describe('createSponsorNeed', () => {
    it('creates a need with default status OPEN', async () => {
      const dto = {
        title: 'Thư viện STEM',
        description: 'Mô tả nhu cầu',
        category: 'education_equipment',
        urgency: NeedUrgency.HIGH,
        cost_estimate: 200000000,
        location: 'Biên Hòa',
        tags: ['stem', 'library'],
        apply_url: 'https://dntu.edu.vn',
      };
      const savedNeed = { id: 'uuid-1', ...dto, status: NeedStatus.OPEN } as any;
      needRepo.create = jest.fn().mockReturnValue(dto);
      needRepo.save = jest.fn().mockResolvedValue(savedNeed);

      const result = await service.createSponsorNeed(dto);
      expect(needRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Thư viện STEM',
          category: 'education_equipment',
          urgency: NeedUrgency.HIGH,
          cost_estimate: 200000000,
          status: NeedStatus.OPEN,
        })
      );
      expect(result).toEqual(savedNeed);
    });
  });

  // ── createSponsorProfile ───────────────────────────────────────────
  describe('createSponsorProfile', () => {
    it('creates a sponsor with defaults', async () => {
      const dto = {
        name: 'Bộ GDĐT',
        description: 'Bộ Giáo dục và Đào tạo',
        focus_areas: ['education', 'scholarship'],
        budget_amount: 5000000000,
        location: 'Hà Nội',
      };
      const savedSponsor = { id: 'uuid-2', ...dto, status: 'active', is_verified: false } as any;
      sponsorRepo.create = jest.fn().mockReturnValue(dto);
      sponsorRepo.save = jest.fn().mockResolvedValue(savedSponsor);

      const result = await service.createSponsorProfile(dto);
      expect(sponsorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bộ GDĐT',
          focus_areas: ['education', 'scholarship'],
          budget_amount: 5000000000,
          status: 'active',
          is_verified: false,
        })
      );
      expect(result).toEqual(savedSponsor);
    });
  });

  // ── rankMatches (pre-filter + AI) ─────────────────────────────────
  describe('rankMatches', () => {
    it('pre-filters by cost (sponsor budget >= need cost)', async () => {
      const needsQb = makeQb();
      const sponsorsQb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(needsQb);
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(sponsorsQb);

      needsQb.getMany.mockResolvedValue([
        { id: 'n1', title: 'Need 1', category: 'education_equipment',
          urgency: 'high', cost_estimate: 100, location: 'Đồng Nai',
          tags: '[]', description: 'desc', deleted_at: null } as any,
        { id: 'n2', title: 'Need 2', category: 'scholarship',
          urgency: 'medium', cost_estimate: 500, location: 'Hà Nội',
          tags: '[]', description: 'desc', deleted_at: null } as any,
      ]);
      sponsorsQb.getMany.mockResolvedValue([
        { id: 's1', name: 'Sponsor 1', budget_amount: 200, location: '',
          focus_areas: '[]', budget_currency: 'VND', status: 'active',
          is_verified: false, description: 'desc' } as any,
        { id: 's2', name: 'Sponsor 2', budget_amount: 1000, location: '',
          focus_areas: '[]', budget_currency: 'VND', status: 'active',
          is_verified: false, description: 'desc' } as any,
      ]);

      aiService.impactMatchRank.mockResolvedValue({
        ranked_matches: [{ need_id: 'n2', sponsor_id: 's2', match_score: 92, match_reasons: ['good'], next_steps: ['contact'] }],
        degraded: false,
      });

      const result = await service.rankMatches({});

      // n1 (cost 100) can match s1 (budget 200) + s2 (budget 1000) = 2 pairs
      // n2 (cost 500) can only match s2 (budget 1000) = 1 pair (s1 has only 200)
      // Total: 3 pairs pre-filtered
      expect(result.pre_filter_summary.total_needs).toBe(2);
      expect(result.pre_filter_summary.total_sponsors).toBe(2);
      expect(result.pre_filter_summary.pre_filtered_pairs).toBe(3);

      expect(aiService.impactMatchRank).toHaveBeenCalled();
      expect(result.ranked_matches.length).toBe(1);
    });

    it('caps pairs at 15 to avoid token overflow', async () => {
      const needsQb = makeQb();
      const sponsorsQb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(needsQb);
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(sponsorsQb);

      // 10 needs, 10 sponsors = 100 possible pairs, but capped at 15
      const needs = Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`, title: `Need ${i}`, category: 'education_equipment',
        urgency: 'medium', cost_estimate: 1, location: '', tags: '[]',
        description: '', deleted_at: null,
      } as any));
      const sponsors = Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`, name: `Sponsor ${i}`, budget_amount: 1000, location: '',
        focus_areas: '[]', budget_currency: 'VND', status: 'active',
        is_verified: false, description: '',
      } as any));

      needsQb.getMany.mockResolvedValue(needs);
      sponsorsQb.getMany.mockResolvedValue(sponsors);
      (aiService.impactMatchRank as jest.Mock).mockResolvedValue({
        ranked_matches: [], degraded: false,
      });

      const result = await service.rankMatches({});
      expect(result.pre_filter_summary.max_pairs).toBe(15);

      // Verify the payload sent to AI was capped at 15 pairs
      const aiPayload = (aiService.impactMatchRank as jest.Mock).mock.calls[0][0];
      expect(aiPayload.pairs.length).toBe(15);
    });

    it('returns empty results when no candidate pairs', async () => {
      const needsQb = makeQb();
      const sponsorsQb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(needsQb);
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(sponsorsQb);

      needsQb.getMany.mockResolvedValue([]);
      sponsorsQb.getMany.mockResolvedValue([]);

      const result = await service.rankMatches({});
      expect(result.ranked_matches).toEqual([]);
      expect(result.pre_filter_summary.pre_filtered_pairs).toBe(0);
      expect(aiService.impactMatchRank).not.toHaveBeenCalled();
    });

    it('degrades gracefully when AI service throws', async () => {
      const needsQb = makeQb();
      const sponsorsQb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(needsQb);
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(sponsorsQb);

      needsQb.getMany.mockResolvedValue([
        { id: 'n1', title: 'Need', category: 'scholarship',
          urgency: 'medium', cost_estimate: 100, location: '',
          tags: '[]', description: '', deleted_at: null } as any,
      ]);
      sponsorsQb.getMany.mockResolvedValue([
        { id: 's1', name: 'Sponsor', budget_amount: 200, location: '',
          focus_areas: '[]', budget_currency: 'VND', status: 'active',
          is_verified: false, description: '' } as any,
      ]);

      (aiService.impactMatchRank as jest.Mock).mockRejectedValue(
        new Error('AI Service unavailable')
      );

      const result = await service.rankMatches({});
      expect(result.degraded).toBe(true);
      expect(result.ranked_matches).toEqual([]);
      expect(result.reason).toContain('AI Service unavailable');
    });

    it('filters by region when provided (need location must match)', async () => {
      const needsQb = makeQb();
      const sponsorsQb = makeQb();
      (needRepo.createQueryBuilder as jest.Mock).mockReturnValue(needsQb);
      (sponsorRepo.createQueryBuilder as jest.Mock).mockReturnValue(sponsorsQb);

      needsQb.getMany.mockResolvedValue([
        { id: 'n1', title: 'Need 1', category: 'education_equipment',
          urgency: 'medium', cost_estimate: 100, location: 'Biên Hòa, Đồng Nai',
          tags: '[]', description: '', deleted_at: null } as any,
        { id: 'n2', title: 'Need 2', category: 'education_equipment',
          urgency: 'medium', cost_estimate: 100, location: 'Hà Nội',
          tags: '[]', description: '', deleted_at: null } as any,
      ]);
      sponsorsQb.getMany.mockResolvedValue([
        { id: 's1', name: 'Sponsor 1', budget_amount: 500, location: 'Biên Hòa, Đồng Nai',
          focus_areas: '[]', budget_currency: 'VND', status: 'active',
          is_verified: false, description: '' } as any,
        { id: 's2', name: 'Sponsor 2', budget_amount: 500, location: 'Hà Nội',
          focus_areas: '[]', budget_currency: 'VND', status: 'active',
          is_verified: false, description: '' } as any,
      ]);

      (aiService.impactMatchRank as jest.Mock).mockResolvedValue({
        ranked_matches: [], degraded: false,
      });

      const result = await service.rankMatches({ region: 'Đồng Nai' });

      // Only n1 (Đồng Nai) qualifies — n2 (Hà Nội) is filtered out by region.
      // With region filter, only need must be in region. s1 and s2 both have
      // budget >= 100, so n1 can match s1 (in Đồng Nai) + s2 (in Hà Nội) = 2 pairs.
      const aiPayload = (aiService.impactMatchRank as jest.Mock).mock.calls[0][0];
      expect(aiPayload.pairs.every((p: any) => p.need_id === 'n1')).toBe(true);
      expect(result.pre_filter_summary.pre_filtered_pairs).toBe(2); // n1 × s1 + n1 × s2
    });
  });

  // ── getSponsorNeedById / getSponsorProfileById ─────────────────────
  describe('getSponsorNeedById', () => {
    it('throws NotFoundException if not found', async () => {
      needRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.getSponsorNeedById('nonexist')).rejects.toThrow();
    });
  });

  describe('getSponsorProfileById', () => {
    it('throws NotFoundException if not found', async () => {
      sponsorRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.getSponsorProfileById('nonexist')).rejects.toThrow();
    });
  });
});
