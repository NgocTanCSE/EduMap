/**
 * Unit tests for RoutingService.safeRoute (Idea #12: SafeRoute AI).
 *
 * Verifies:
 *  - Multiple alternative routes are returned with safety scores.
 *  - Routes are sorted descending by safetyScore (best first).
 *  - Flood/traffic factors influence the ranking.
 *  - When ORS/OSRM are unavailable, the Haversine fallback is used
 *    and `estimated` is set to true.
 *  - Geometry JSON-string parsing works correctly.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { RoutingService, SafeRoutePreferences } from './routing.service';
import { FloodRoutingService } from './flood-routing.service';
import { TrafficRoutingService, TrafficAwareRoute } from './traffic-routing.service';

// ── Test fixtures ────────────────────────────────────────────────────

// Three distinct routes from a mock ORS alternative-routes response
const makeRoute = (dist: number, dur: number, coords: [number, number][]) => ({
  geometry: JSON.stringify({ type: 'LineString', coordinates: coords }),
  legs: [{ steps: [], summary: '', weight: dur, duration: dur, distance: dist }],
  weight_name: 'duration',
  weight: dur,
  duration: dur,
  distance: dist,
});

const ORIGIN: [number, number] = [106.843, 10.957]; // Biên Hòa
const DESTINATION: [number, number] = [106.870, 10.945];

const mockOrsResponse = {
  data: {
    features: [
      {
        geometry: { type: 'LineString', coordinates: [[106.843, 10.957], [106.860, 10.950], [106.870, 10.945]] },
        properties: {
          summary: { duration: 300, distance: 3000 },
          segments: [{ duration: 300, distance: 3000, steps: [] }],
          waypoints: [{ location: [106.843, 10.957] }, { location: [106.870, 10.945] }],
        },
      },
      {
        geometry: { type: 'LineString', coordinates: [[106.843, 10.957], [106.855, 10.955], [106.865, 10.950], [106.870, 10.945]] },
        properties: {
          summary: { duration: 360, distance: 3800 },
          segments: [{ duration: 360, distance: 3800, steps: [] }],
          waypoints: [{ location: [106.843, 10.957] }, { location: [106.870, 10.945] }],
        },
      },
      {
        geometry: { type: 'LineString', coordinates: [[106.843, 10.957], [106.850, 10.948], [106.870, 10.945]] },
        properties: {
          summary: { duration: 240, distance: 2500 },
          segments: [{ duration: 240, distance: 2500, steps: [] }],
          waypoints: [{ location: [106.843, 10.957] }, { location: [106.870, 10.945] }],
        },
      },
    ],
    waypoints: [
      { location: [106.843, 10.957], name: 'Origin' },
      { location: [106.870, 10.945], name: 'Destination' },
    ],
  },
};

const mockEmptyOrsResponse = { data: { features: [], waypoints: [] } };

const defaultPrefs: SafeRoutePreferences = {
  avoidFlood: true,
  avoidTraffic: true,
  safetyWeight: 0.3,
};

describe('RoutingService — safeRoute (SafeRoute AI)', () => {
  let service: RoutingService;
  let httpService: jest.Mocked<HttpService>;
  let floodService: jest.Mocked<FloodRoutingService>;
  let trafficService: jest.Mocked<TrafficRoutingService>;

  beforeEach(async () => {
    const mockHttp = { post: jest.fn(), get: jest.fn(), axiosRef: { post: jest.fn(), get: jest.fn() } };
    const mockConfig = { get: jest.fn().mockImplementation((key: string) => {
      if (key === 'ORS_URL') return 'https://api.openrouteservice.org';
      if (key === 'ORS_API_KEY') return 'test-key';
      if (key === 'OSRM_URL') return 'https://router.project-osrm.org';
      return undefined;
    }) };
    const mockFlood = { checkRouteForFloods: jest.fn(), getActiveFloodZones: jest.fn(), getFloodAvoidancePolygons: jest.fn() };
    const mockTraffic = {
      analyzeRouteTraffic: jest.fn(),
      detectRoadType: jest.fn(),
      haversineDistance: jest.fn(),
      getCongestionColor: jest.fn(),
      getCongestionLabel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: FloodRoutingService, useValue: mockFlood },
        { provide: TrafficRoutingService, useValue: mockTraffic },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
    httpService = module.get(HttpService);
    floodService = module.get(FloodRoutingService);
    trafficService = module.get(TrafficRoutingService);

    // Default mocks: ORS returns 3 routes, no flood/traffic issues
    httpService.post.mockReturnValue(of(mockOrsResponse as any));
    floodService.checkRouteForFloods.mockResolvedValue({ intersects: false, floodZones: [], affectedSegments: 0 });
    trafficService.analyzeRouteTraffic.mockResolvedValue({
      geometry: { type: 'LineString', coordinates: [] },
      duration: 300,
      distance: 3000,
      trafficSegments: [],
      totalDelay: 0,
      congestionSummary: { free: 10, light: 0, moderate: 0, heavy: 0 },
    } as TrafficAwareRoute);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return multiple routes sorted by safety score (descending)', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    expect(result.routes).toBeDefined();
    expect(result.routes.length).toBeGreaterThanOrEqual(2);
    expect(result.routes.length).toBeLessThanOrEqual(3); // ORS returns at most 3

    // Verify descending order
    for (let i = 0; i < result.routes.length - 1; i++) {
      expect(result.routes[i].safetyScore).toBeGreaterThanOrEqual(result.routes[i + 1].safetyScore);
    }
  });

  it('should mark the first route as primary', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);
    expect(result.routes[0].isPrimary).toBe(true);
    expect(result.bestRouteIndex).toBe(0);
  });

  it('should include safety factors for each route', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    for (const route of result.routes) {
      expect(route.safetyFactors).toBeDefined();
      expect(route.safetyFactors.floodRisk).toBeGreaterThanOrEqual(0);
      expect(route.safetyFactors.floodRisk).toBeLessThanOrEqual(100);
      expect(route.safetyFactors.trafficRisk).toBeGreaterThanOrEqual(0);
      expect(route.safetyFactors.trafficRisk).toBeLessThanOrEqual(100);
      expect(route.safetyFactors.distanceScore).toBeGreaterThanOrEqual(0);
      expect(route.safetyFactors.distanceScore).toBeLessThanOrEqual(100);
      expect(route.safetyFactors.durationScore).toBeGreaterThanOrEqual(0);
      expect(route.safetyFactors.durationScore).toBeLessThanOrEqual(100);
      expect(route.safetyScore).toBeGreaterThanOrEqual(0);
      expect(route.safetyScore).toBeLessThanOrEqual(100);
    }
  });

  it('should check flood zones when avoidFlood is true', async () => {
    await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    // Each route's geometry should be checked
    expect(floodService.checkRouteForFloods).toHaveBeenCalledTimes(3);
  });

  it('should skip flood checks when avoidFlood is false', async () => {
    const prefs: SafeRoutePreferences = { avoidFlood: false, avoidTraffic: true, safetyWeight: 0.3 };
    await service.safeRoute(ORIGIN, DESTINATION, prefs);

    expect(floodService.checkRouteForFloods).not.toHaveBeenCalled();
  });

  it('should analyze traffic when avoidTraffic is true', async () => {
    await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);
    expect(trafficService.analyzeRouteTraffic).toHaveBeenCalled();
  });

  it('should skip traffic analysis when avoidTraffic is false', async () => {
    const prefs: SafeRoutePreferences = { avoidFlood: true, avoidTraffic: false, safetyWeight: 0.3 };
    await service.safeRoute(ORIGIN, DESTINATION, prefs);
    expect(trafficService.analyzeRouteTraffic).not.toHaveBeenCalled();
  });

  it('should rank flood-affected routes lower', async () => {
    // Route 0: no flood. Route 1: intersects flood. Route 2: no flood.
    floodService.checkRouteForFloods.mockImplementation(async (geom: any) => {
      const coords = geom.coordinates;
      const hasFlood = coords.some((c: number[]) => c[0] > 106.862 && c[0] < 106.868);
      return {
        intersects: hasFlood,
        floodZones: hasFlood ? [{ id: 'zone-1', name: 'Khu ngập', riskLevel: 'high', coordinates: {}, metadata: {} }] : [],
        affectedSegments: hasFlood ? 3 : 0,
      };
    });

    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);
    const floodRoute = result.routes.find(r => r.safetyFactors.floodRisk > 0);
    const safeRoutes = result.routes.filter(r => r.safetyFactors.floodRisk === 0);

    // If there's a flood-affected route, it should rank lower than safe routes
    if (floodRoute && safeRoutes.length > 0) {
      const floodIdx = result.routes.indexOf(floodRoute);
      const bestSafeIdx = result.routes.indexOf(safeRoutes[0]);
      // safeRoutes[0] was the first safe route before sorting; after sorting
      // floodRoute should not be the best route
      expect(floodRoute.isPrimary).not.toBe(true);
    }
  });

  it('should fall back to Haversine and set estimated=true when no routing provider is available', async () => {
    // All providers fail
    httpService.post.mockReturnValue(throwError(() => new Error('ORS unreachable')));
    httpService.get.mockReturnValue(throwError(() => new Error('OSRM unreachable')));

    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    expect(result.estimated).toBe(true);
    expect(result.provider).toBe('haversine');
    expect(result.routes.length).toBe(1);
    expect(result.routes[0].isPrimary).toBe(true);
    // Haversine route has minimal info; safety score should still be computed
    expect(result.routes[0].safetyScore).toBeGreaterThanOrEqual(0);
  });

  it('should parse JSON-string geometry before flood/traffic checks', async () => {
    // ORS returns geometry as object; translateOrsToRouteResponse converts to JSON string
    // safeRoute must re-parse the JSON string back to object for spatial intersection
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    // Verify flood check received a parsed geometry object (not a string)
    const floodCallArg = floodService.checkRouteForFloods.mock.calls[0][0];
    expect(floodCallArg).toBeDefined();
    expect(typeof floodCallArg).not.toBe('string');
    expect(floodCallArg.type).toBe('LineString');
    expect(Array.isArray(floodCallArg.coordinates)).toBe(true);
  });

  it('should include Vietnamese explanation for each route', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    for (const route of result.routes) {
      expect(route.explanation).toBeDefined();
      expect(route.explanation.length).toBeGreaterThan(10);
    }
  });

  it('should include origin, destination, and preferences in result', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    expect(result.origin).toEqual(ORIGIN);
    expect(result.destination).toEqual(DESTINATION);
    expect(result.preferences).toEqual(defaultPrefs);
  });

  it('should respect maxDistanceKm preference when filtering', async () => {
    const prefs: SafeRoutePreferences = {
      avoidFlood: true, avoidTraffic: true, safetyWeight: 0.3, maxDistanceKm: 2.0,
    };
    const result = await service.safeRoute(ORIGIN, DESTINATION, prefs);

    // All returned routes should be within or close to maxDistanceKm
    // (Haversine fallback always passes; ORS routes should be filtered)
    for (const route of result.routes) {
      const distKm = route.distance / 1000;
      expect(distKm).toBeLessThanOrEqual(prefs.maxDistanceKm! + 1.0); // +1 km tolerance
    }
  });

  it('should degrade gracefully when flood check throws', async () => {
    floodService.checkRouteForFloods.mockRejectedValue(new Error('DB table missing'));

    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    // Should not throw — routes still returned with floodRisk=0
    expect(result.routes.length).toBeGreaterThan(0);
    for (const route of result.routes) {
      expect(route.safetyFactors.floodRisk).toBe(0);
    }
  });

  it('should degrade gracefully when traffic analysis throws', async () => {
    trafficService.analyzeRouteTraffic.mockRejectedValue(new Error('Traffic DB missing'));

    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    expect(result.routes.length).toBeGreaterThan(0);
    for (const route of result.routes) {
      expect(route.safetyFactors.trafficRisk).toBe(0);
    }
  });

  it('should produce safety scores in 0-100 range', async () => {
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    for (const route of result.routes) {
      expect(route.safetyScore).toBeGreaterThanOrEqual(0);
      expect(route.safetyScore).toBeLessThanOrEqual(100);
    }
  });

  it('should compute higher safety scores for shorter/cleaner routes', async () => {
    // Route 0 is shortest (2.5km, 240s) and flood-free
    // Route 1 is longer (3.8km, 360s) and has no flood
    // Route 0 should have a higher safety score than Route 1
    const result = await service.safeRoute(ORIGIN, DESTINATION, defaultPrefs);

    // The shortest route (Route 2 in ORS response, 2.5km/240s) should rank first
    expect(result.routes[0].distance).toBe(2500);
    expect(result.routes[0].safetyScore).toBeGreaterThanOrEqual(result.routes[1].safetyScore);
  });
});
