import { TrafficRoutingService } from './traffic-routing.service';
import { TrafficSegment } from './entities/traffic-segment.entity';
describe('TrafficRoutingService (SQLite / HF Spaces)', () => {
    let service: TrafficRoutingService;
    let trafficRepo: {
        find: jest.Mock;
        createQueryBuilder: jest.Mock;
    };
    const ORIGINAL_DB_TYPE = process.env.DB_TYPE;
    beforeEach(() => {
        process.env.DB_TYPE = 'sqlite';
        trafficRepo = {
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                setParameters: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            })),
        };
        service = new TrafficRoutingService(trafficRepo as any);
    });
    afterEach(() => {
        process.env.DB_TYPE = ORIGINAL_DB_TYPE;
    });
    it('does NOT execute PostGIS ST_MakePoint on SQLite — falls back to heuristic', async () => {
        trafficRepo.find.mockResolvedValue([]);
        const route = {
            type: 'LineString' as const,
            coordinates: [[106.87, 10.95], [106.88, 10.96]],
        };
        const result = await service.analyzeRouteTraffic(route);
        expect(trafficRepo.createQueryBuilder).toHaveBeenCalled();
        expect(result.trafficSegments[0].segmentId).toBe('heuristic');
        expect(result.duration).toBeGreaterThan(0);
    });
    it('matches a nearby DB segment via JS Haversine proximity (no PostGIS)', async () => {
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
        trafficRepo.createQueryBuilder.mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            setParameters: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([segment as TrafficSegment]),
        }));
        const route = {
            type: 'LineString' as const,
            coordinates: [[106.872, 10.95], [106.88, 10.955]],
        };
        const result = await service.analyzeRouteTraffic(route);
        expect(trafficRepo.createQueryBuilder).toHaveBeenCalled();
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
