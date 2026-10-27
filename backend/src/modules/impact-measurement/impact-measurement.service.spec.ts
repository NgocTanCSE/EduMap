import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImpactMeasurementService } from './impact-measurement.service';
import { AIService } from '../ai/ai.service';
import { MapPoint } from '../map/entities/map-point.entity';

describe('ImpactMeasurementService', () => {
  let service: ImpactMeasurementService;
  let mapPointRepo: jest.Mocked<Repository<MapPoint>>;
  let aiService: jest.Mocked<AIService>;

  // A handful of real-shaped facility rows (Biên Hòa city core coordinates).
  const mockFacilities = [
    { id: '1', name: 'Wifi A', type_id: 6, location: '{"type":"Point","coordinates":[106.8778,10.9525]}', created_at: '2025-02-01', status: 'active' },
    { id: '2', name: 'Thư viện B', type_id: 3, location: '{"type":"Point","coordinates":[106.8780,10.9528]}', created_at: '2025-03-01', status: 'active' },
    { id: '3', name: 'Lab C', type_id: 5, location: '{"type":"Point","coordinates":[106.8770,10.9530]}', created_at: '2025-01-15', status: 'active' },
    { id: '4', name: 'School D', type_id: 2, location: '{"type":"Point","coordinates":[106.9000,10.9600]}', created_at: '2024-06-01', status: 'active' }, // before Jan 2025
  ];

  beforeEach(async () => {
    mapPointRepo = {
      query: jest.fn().mockResolvedValue(mockFacilities),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MapPoint>>;

    aiService = {
      measureImpact: jest.fn(),
    } as unknown as jest.Mocked<AIService>;

    process.env.DB_TYPE = 'sqlite'; // exercise the raw-SQL path

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactMeasurementService,
        { provide: getRepositoryToken(MapPoint), useValue: mapPointRepo },
        { provide: AIService, useValue: aiService },
      ],
    }).compile();

    service = module.get<ImpactMeasurementService>(ImpactMeasurementService);
  });

  afterEach(() => { delete (service as any)._cache; (service as any)._cache = new Map(); });

  describe('computeMetrics (T1 — before/after diff)', () => {
    it('splits facilities by deployment_date and computes before/after cohorts', async () => {
      const metrics = await service.computeMetrics({
        minLat: '10.9', maxLat: '11.0', minLng: '106.8', maxLng: '107.0',
        deploymentDate: '2025-01-01',
      });
      // School D (2024-06-01) → before; the 3 2025 facilities → after.
      expect(metrics.before.facility_count).toBe(1);
      expect(metrics.after.facility_count).toBe(3);
      expect(metrics.diff.user_count_delta).toBe(
        metrics.after.user_count - metrics.before.user_count,
      );
      expect(metrics.population_estimate).toBeGreaterThan(0);
      expect(metrics.region).toBeTruthy();
    });

    it('uses a synthetic baseline when no before-cohort facilities exist', async () => {
      const metrics = await service.computeMetrics({
        minLat: '10.9', maxLat: '11.0', minLng: '106.8', maxLng: '107.0',
        deploymentDate: '2023-01-01', // before all seeded facilities
      });
      expect(metrics.before.synthetic_baseline).toBe(true);
      expect(metrics.before.access_rate).toBeCloseTo(0.7, 5);
      expect(metrics.after.facility_count).toBe(4);
    });

    it('returns coverage_improvement_pct and a deployment_timeline', async () => {
      const metrics = await service.computeMetrics({
        minLat: '10.9', maxLat: '11.0', minLng: '106.8', maxLng: '107.0',
        deploymentDate: '2025-01-01',
      });
      expect(typeof metrics.diff.coverage_improvement_pct).toBe('number');
      expect(Array.isArray(metrics.deployment_timeline)).toBe(true);
    });

    it('falls back to a tight Biên Hòa bbox when no region is given', async () => {
      const metrics = await service.computeMetrics({});
      expect(metrics.bbox[0]).toBeCloseTo(10.9, 1);
      expect(metrics.bbox[2]).toBeCloseTo(106.8, 1);
    });
  });

  describe('measure (T1 + T2 merge + graceful degradation)', () => {
    it('merges ai-service result on success', async () => {
      const aiResult = {
        impact_score: 42.0,
        confidence_interval: { lower: 30.0, upper: 54.0, level: 0.95, method: 'wilson_score' },
        people_in_radius: { before: 100, after: 130, delta: 30, radius_km: 5.0 },
        trend: { monthly: [], growth_rate_pct: 10, trend: 'tăng' },
        narrative: 'test narrative',
        causal_notes: ['note'],
        degraded: false,
      };
      aiService.measureImpact.mockResolvedValue(aiResult);

      const result = await service.measure({
        minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0,
        deploymentDate: '2025-01-01', region: 'Biên Hòa, Đồng Nai',
      });
      expect(aiService.measureImpact).toHaveBeenCalledTimes(1);
      expect(result.impact_score).toBe(42.0);
      expect(result.diff).toBeDefined(); // backend diff is preserved
      expect(result.degraded).toBe(false);
    });

    it('degrades gracefully when the ai-service is unavailable (returns null)', async () => {
      aiService.measureImpact.mockResolvedValue(null as any);

      const result = await service.measure({
        minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0,
        deploymentDate: '2025-01-01', region: 'Biên Hòa, Đồng Nai',
      });
      expect(result.degraded).toBe(true);
      expect(result.reason).toContain('AI service unavailable');
      // Backend-only enrichment still produces a score + CI.
      expect(result.impact_score).toBeGreaterThanOrEqual(0);
      expect(result.impact_score).toBeLessThanOrEqual(100);
      expect(result.confidence_interval).toBeDefined();
    });

    it('degrades gracefully when the ai-service throws', async () => {
      aiService.measureImpact.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.measure({
        minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0,
        deploymentDate: '2025-01-01', region: 'Biên Hòa, Đồng Nai',
      });
      expect(result.degraded).toBe(true);
      expect(result.impact_score).toBeGreaterThanOrEqual(0);
    });

    it('caches the merged result for 24 h', async () => {
      aiService.measureImpact.mockResolvedValue({
        impact_score: 50, confidence_interval: { lower: 40, upper: 60, level: 0.95, method: 'wilson' },
        people_in_radius: { before: 1, after: 2, delta: 1, radius_km: 5 },
        trend: { monthly: [], growth_rate_pct: 0, trend: 'ổn định' },
        narrative: 'x', causal_notes: [], degraded: true,
      });

      const first = await service.measure({ minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0, deploymentDate: '2025-01-01' });
      const second = await service.measure({ minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0, deploymentDate: '2025-01-01' });
      expect(aiService.measureImpact).toHaveBeenCalledTimes(1); // 2nd hit served from cache
      // Cache hits mirror the ai-service: they add a `cached: true` flag.
      expect((second as any).cached).toBe(true);
      const { cached, ...secondNoFlag } = second as any;
      expect(secondNoFlag).toEqual(first);
    });
  });
});
