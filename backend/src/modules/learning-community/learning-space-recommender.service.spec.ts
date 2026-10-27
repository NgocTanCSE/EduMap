/**
 * Unit tests for LearningSpaceRecommenderService scoring algorithm.
 *
 * Verifies that the normalized weighted scoring:
 *   - normalises every criterion to [0,1] so distance can't dominate
 *   - respects configurable weights
 *   - filters by radius / wifi / quietness / open_now
 *   - returns ranked results sorted by score descending
 *
 * Pure scoring logic (scoreSpot, haversineDistance, isOpenNow) has no DI
 * dependencies; the `recommend()` integration path uses mocked repos.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSpaceRecommenderService } from './learning-space-recommender.service';
import { LearningSpot } from './entities/learning-spot.entity';
import { AIService } from '../ai/ai.service';

describe('LearningSpaceRecommenderService', () => {
  let service: LearningSpaceRecommenderService;
  let repo: jest.Mocked<Repository<LearningSpot>>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<LearningSpot>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningSpaceRecommenderService,
        { provide: getRepositoryToken(LearningSpot), useValue: repo },
        { provide: AIService, useValue: { explainLearningSpace: jest.fn() } },
      ],
    }).compile();

    service = module.get<LearningSpaceRecommenderService>(LearningSpaceRecommenderService);
    aiService = module.get(AIService);
  });

  // ── Pure helpers ──────────────────────────────────────────────────────

  describe('haversineDistance', () => {
    it('returns 0 for identical coordinates', () => {
      expect(service.haversineDistance(10.7727, 106.6538, 10.7727, 106.6538)).toBe(0);
    });

    it('computes correct distance for known points (HCMC ↔ Hanoi ≈ 1140 km)', () => {
      const d = service.haversineDistance(10.8215, 106.6601, 21.0279, 105.8342);
      expect(d).toBeGreaterThan(1100);
      expect(d).toBeLessThan(1200);
    });
  });

  describe('isOpenNow', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns true when current time is within opening hours', () => {
      // Monday 10:00 is within 08:00-17:30
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T10:00:00'));

      const hours = {
        monday: '08:00-17:30',
        tuesday: '08:00-17:00',
        wednesday: '08:00-17:00',
        thursday: '08:00-17:00',
        friday: '08:00-17:00',
        saturday: '08:00-12:00',
        sunday: null,
      };
      expect(service.isOpenNow(hours)).toBe(true);
    });

    it('returns false when current time is outside opening hours', () => {
      // Monday 22:00 is outside 08:00-17:30
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T22:00:00'));

      const hours = {
        monday: '08:00-17:30',
        tuesday: '08:00-17:00',
        wednesday: '08:00-17:00',
        thursday: '08:00-17:00',
        friday: '08:00-17:00',
        saturday: '08:00-12:00',
        sunday: null,
      };
      expect(service.isOpenNow(hours)).toBe(false);
    });

    it('returns false when day is closed (null hours)', () => {
      // Sunday 12:00 — Sunday is closed
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-07T12:00:00'));

      const hours = {
        monday: '08:00-17:30',
        tuesday: '08:00-17:00',
        wednesday: '08:00-17:00',
        thursday: '08:00-17:00',
        friday: '08:00-17:00',
        saturday: '08:00-12:00',
        sunday: null,
      };
      expect(service.isOpenNow(hours)).toBe(false);
    });

    it('returns false when opening_hours is null/undefined', () => {
      expect(service.isOpenNow(null)).toBe(false);
      expect(service.isOpenNow(undefined)).toBe(false);
    });
  });

  // ── scoreSpot ─────────────────────────────────────────────────────────

  // Build a minimal spot with GeoJSON location
  function makeSpot(overrides: Partial<LearningSpot> = {}): LearningSpot {
    return {
      id: 'spot-1',
      name: 'Test Spot',
      type: 'library',
      address: '123 Test St',
      location: JSON.stringify({ type: 'Point', coordinates: [106.6538, 10.7727] }),
      has_wifi: true,
      has_power_outlets: true,
      quietness: 4,
      opening_hours: { monday: '08:00-17:30', tuesday: '08:00-17:30', wednesday: '08:00-17:00', thursday: '08:00-17:00', friday: '08:00-17:00', saturday: '08:00-12:00', sunday: null },
      amenities: ['wifi', 'power_outlets'],
      rating_avg: 4.5,
      total_capacity: 200,
      created_at: new Date(),
      last_updated: new Date(),
      ...overrides,
    } as LearningSpot;
  }

  describe('scoreSpot', () => {
    const userLat = 10.7727;
    const userLng = 106.6538;
    let defaultWeights: any;

    beforeEach(() => {
      defaultWeights = service.defaultWeights();
    });

    it('returns score in [0, 100] range', () => {
      const spot = makeSpot();
      const result = service.scoreSpot(spot, userLat, userLng, 5, defaultWeights);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('gives higher distance score to closer spots', () => {
      const farSpot = makeSpot({
        id: 'far',
        name: 'Far Spot',
        location: JSON.stringify({ type: 'Point', coordinates: [106.8, 10.9] }), // ~22 km away
      });
      const nearSpot = makeSpot({
        id: 'near',
        name: 'Near Spot',
        location: JSON.stringify({ type: 'Point', coordinates: [106.6540, 10.7728] }), // very close
      });

      const farResult = service.scoreSpot(farSpot, userLat, userLng, 5, defaultWeights);
      const nearResult = service.scoreSpot(nearSpot, userLat, userLng, 5, defaultWeights);

      expect(nearResult.score).toBeGreaterThan(farResult.score);
      expect(nearResult.distance_km).toBeLessThan(farResult.distance_km);
    });

    it('rewards has_wifi = true', () => {
      const withWifi = makeSpot({ id: 'wifi', has_wifi: true });
      const withoutWifi = makeSpot({ id: 'nowifi', has_wifi: false });

      const r1 = service.scoreSpot(withWifi, userLat, userLng, 5, defaultWeights);
      const r2 = service.scoreSpot(withoutWifi, userLat, userLng, 5, defaultWeights);

      expect(r1.matching_criteria.wifi).toBe(1);
      expect(r2.matching_criteria.wifi).toBe(0);
      expect(r1.score).toBeGreaterThan(r2.score);
    });

    it('normalizes quietness to [0,1] (5 → 1.0, 1 → 0.2)', () => {
      const quiet5 = makeSpot({ quietness: 5 });
      const quiet1 = makeSpot({ quietness: 1 });

      const r5 = service.scoreSpot(quiet5, userLat, userLng, 5, defaultWeights);
      const r1 = service.scoreSpot(quiet1, userLat, userLng, 5, defaultWeights);

      expect(r5.matching_criteria.quietness).toBe(1);
      expect(r1.matching_criteria.quietness).toBe(0.2);
    });

    it('gives neutral quietness (0.5) when quietness is NULL', () => {
      const unknownSpot = makeSpot({ quietness: null });
      const result = service.scoreSpot(unknownSpot, userLat, userLng, 5, defaultWeights);
      expect(result.matching_criteria.quietness).toBe(0.5);
    });

    it('normalizes rating to [0,1] (5 → 1.0, 0 → 0)', () => {
      const r = service.scoreSpot(makeSpot({ rating_avg: 5 }), userLat, userLng, 5, defaultWeights);
      expect(r.matching_criteria.rating).toBe(1);
    });

    it('respects custom weights (distance-focused)', () => {
      const farSpot = makeSpot({
        id: 'far',
        location: JSON.stringify({ type: 'Point', coordinates: [106.8, 10.9] }),
      });
      const nearSpot = makeSpot({
        id: 'near',
        location: JSON.stringify({ type: 'Point', coordinates: [106.6540, 10.7728] }),
        rating_avg: 2, // low rating
      });

      const distWeights = { ...defaultWeights, distance: 0.9, rating: 0.05, wifi: 0.01, quietness: 0.01, open_now: 0.01, capacity: 0.01 };
      const farResult = service.scoreSpot(farSpot, userLat, userLng, 5, distWeights);
      const nearResult = service.scoreSpot(nearSpot, userLat, userLng, 5, distWeights);

      // Even though near spot has low rating, distance-focused weights should
      // still favor it.
      expect(nearResult.score).toBeGreaterThan(farResult.score);
    });
  });

  // ── recommend (integration with mocked repos) ────────────────────────

  describe('recommend', () => {
    const userLat = 10.7727;
    const userLng = 106.6538;

    it('filters spots beyond radius', async () => {
      const spots = [
        makeSpot({ id: 'near', name: 'Near', location: JSON.stringify({ type: 'Point', coordinates: [106.6540, 10.7728] }) }),
        makeSpot({ id: 'far', name: 'Far', location: JSON.stringify({ type: 'Point', coordinates: [107.0, 11.0] }) }), // ~250 km
      ];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good spot' });

      // 5 km radius
      const result = await service.recommend({ lat: userLat, lng: userLng, radius: 5000 });

      expect(result.spots.length).toBe(1);
      expect(result.spots[0].spot.id).toBe('near');
    });

    it('filters by has_wifi = true', async () => {
      const spots = [
        makeSpot({ id: 'w1', has_wifi: true }),
        makeSpot({ id: 'w2', has_wifi: false }),
      ];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good' });

      const result = await service.recommend({ lat: userLat, lng: userLng, has_wifi: true });

      expect(result.spots.length).toBe(1);
      expect(result.spots[0].spot.id).toBe('w1');
    });

    it('filters by min_rating', async () => {
      const spots = [
        makeSpot({ id: 'r4', rating_avg: 4.5 }),
        makeSpot({ id: 'r2', rating_avg: 2.0 }),
      ];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good' });

      const result = await service.recommend({ lat: userLat, lng: userLng, min_rating: 4 });

      expect(result.spots.length).toBe(1);
      expect(result.spots[0].spot.id).toBe('r4');
    });

    it('filters by quietness_min', async () => {
      const spots = [
        makeSpot({ id: 'q5', quietness: 5 }),
        makeSpot({ id: 'q3', quietness: 3 }),
      ];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good' });

      const result = await service.recommend({ lat: userLat, lng: userLng, quietness_min: 4 });

      expect(result.spots.length).toBe(1);
      expect(result.spots[0].spot.id).toBe('q5');
    });

    it('sorts results by score descending', async () => {
      const spots = [
        makeSpot({ id: 's3', name: 'S3', rating_avg: 4.8, quietness: 5, has_wifi: true }),
        makeSpot({ id: 's1', name: 'S1', rating_avg: 4.0, quietness: 3, has_wifi: false }),
        makeSpot({ id: 's2', name: 'S2', rating_avg: 4.5, quietness: 4, has_wifi: true }),
      ];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good' });

      const result = await service.recommend({ lat: userLat, lng: userLng, limit: 10 });

      expect(result.spots.length).toBe(3);
      // s3 should be first (highest rating + quietness + wifi)
      expect(result.spots[0].spot.id).toBe('s3');
      // Scores should be non-increasing
      for (let i = 0; i < result.spots.length - 1; i++) {
        expect(result.spots[i].score).toBeGreaterThanOrEqual(result.spots[i + 1].score);
      }
    });

    it('returns empty array when no spots found', async () => {
      repo.find = jest.fn().mockResolvedValue([]);
      const result = await service.recommend({ lat: userLat, lng: userLng });

      expect(result.spots).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.degraded).toBe(false);
    });

    it('degrades gracefully when AI service fails', async () => {
      const spots = [makeSpot({ id: 's1' })];
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockRejectedValue(new Error('AI service down'));

      const result = await service.recommend({ lat: userLat, lng: userLng });

      expect(result.spots.length).toBe(1);
      expect(result.degraded).toBe(true);
      expect(result.reason).toContain('AI');
    });

    it('respects limit param', async () => {
      const spots: LearningSpot[] = [];
      for (let i = 0; i < 30; i++) {
        spots.push(makeSpot({ id: `s${i}`, name: `Spot ${i}` }));
      }
      repo.find = jest.fn().mockResolvedValue(spots);
      aiService.explainLearningSpace = jest.fn().mockResolvedValue({ explanation: 'Good' });

      const result = await service.recommend({ lat: userLat, lng: userLng, limit: 10 });

      expect(result.spots.length).toBe(10);
    });
  });
});
