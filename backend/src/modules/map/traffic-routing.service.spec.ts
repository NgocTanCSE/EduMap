import { TrafficRoutingService } from './traffic-routing.service';
import { TrafficSegment } from './entities/traffic-segment.entity';

/**
 * Regression + behaviour tests for TrafficRoutingService on SQLite (the HF
 * Spaces free-plan runtime). The previous implementation shipped a raw
 * PostGIS query (`ST_DWithin(... ST_MakePoint(...))`) to SQLite, which threw
 * `SQLITE_ERROR: no such function: ST_MakePoint` on every route analysis and
 * only survived thanks to the catch → heuristic fallback (noisy WARN spam).
 *
 * AGENTS.md §7: query builders MUST branch on `isPostgresNow()` and compute
 * distances in JS when running SQLite. These tests pin that contract.
 */
describe('TrafficRoutingService (SQLite / HF Spaces)', () => {
  let service: TrafficRoutingService;
  let trafficRepo: { find: jest.Mock; createQueryBuilder: jest.Mock };

  const ORIGINAL_DB_TYPE = process.env.DB_TYPE;

  beforeEach(() => {
    // isPostgresNow() reads process.env.DB_TYPE at call time.
    process.env.DB_TYPE = 'sqlite';

    trafficRepo = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    // Partial mock is enough: the service only uses repo.find() on SQLite.
    service = new TrafficRoutingService(trafficRepo as any);
  });

  afterEach(() => {
    process.env.DB_TYPE = ORIGINAL_DB_TYPE;
  });

  it('does NOT execute PostGIS ST_MakePoint on SQLite — falls back to heuristic', async () => {
    // No DB-backed segments at all (table may not exist → empty result).
    trafficRepo.find.mockResolvedValue([]);

    const route = {
      type: 'LineString' as const,
      coordinates: [[106.87, 10.95], [106.88, 10.96]],
    };

    const result = await service.analyzeRouteTraffic(route);

    // The DB query path on SQLite uses repo.find(), never createQueryBuilder
    // with ST_MakePoint.
    expect(trafficRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.trafficSegments[0].segmentId).toBe('heuristic');
    expect(result.duration).toBeGreaterThan(0);
  });

  it('matches a nearby DB segment via JS Haversine proximity (no PostGIS)', async () => {
    // GeoJSON LineString matching the migrated "Đường Nguyễn Khuyến" segment.
    const segment: Partial<TrafficSegment> = {
      id: 'seg-nk',
      roadName: 'Đường Nguyễn Khuyến',
      roadType: 'primary',
      coordinates: {
        type: 'LineString',
        coordinates: [[106.872, 10.95], [106.88, 10.955]],
      },
      freeFlowSpeed: 60,
      congestionProfile: {
        hourlySpeedFactor: Array(24).fill(0.9),
        dailyFactor: Array(7).fill(1),
      },
      congestionLevel: 1,
      dataSource: 'historical',
    };
    trafficRepo.find.mockResolvedValue([segment as TrafficSegment]);

    // Route runs along the segment.
    const route = {
      type: 'LineString' as const,
      coordinates: [[106.872, 10.95], [106.88, 10.955]],
    };

    const result = await service.analyzeRouteTraffic(route);

    expect(trafficRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.trafficSegments[0].segmentId).toBe('seg-nk');
    expect(result.trafficSegments[0].roadName).toBe('Đường Nguyễn Khuyến');
    expect(result.trafficSegments[0].freeFlowSpeed).toBe(60);
  });

  it('falls back to heuristic when no DB segment is within range', async () => {
    const segment: Partial<TrafficSegment> = {
      id: 'seg-nk',
      roadName: 'Đường Nguyễn Khuyến',
      roadType: 'primary',
      coordinates: {
        type: 'LineString',
        coordinates: [[106.872, 10.95], [106.88, 10.955]],
      },
      freeFlowSpeed: 60,
      congestionProfile: { hourlySpeedFactor: Array(24).fill(0.9), dailyFactor: Array(7).fill(1) },
      congestionLevel: 0,
      dataSource: 'historical',
    };
    trafficRepo.find.mockResolvedValue([segment as TrafficSegment]);

    // Route is far away (district of Biên Hòa vs. HCM City coordinates).
    const route = {
      type: 'LineString' as const,
      coordinates: [[106.6, 10.77], [106.61, 10.78]],
    };

    const result = await service.analyzeRouteTraffic(route);

    expect(result.trafficSegments[0].segmentId).toBe('heuristic');
  });

  it('returns an empty route for malformed geometry', async () => {
    const result = await service.analyzeRouteTraffic(null);
    expect(result.trafficSegments).toEqual([]);
    expect(result.duration).toBe(0);
  });
});
