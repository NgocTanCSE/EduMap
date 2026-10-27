/**
 * Unit tests for MapService.getResourceOptimization (Idea #1: MCLP proxy + cache).
 *
 * Verifies:
 *  - On cache miss, the service fetches POIs from the DB and proxies a POST
 *    to the ai-service /api/ai/resource/optimize endpoint.
 *  - On cache hit (same params within TTL), the cached result is returned
 *    without re-calling the ai-service.
 *  - When the ai-service is down, a graceful-degradation fallback GeoJSON
 *    is returned (never throws).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import { MapService, PointOfInterest } from './map.service';
import { MapPoint } from './entities/map-point.entity';
import { Location } from './entities/location.entity';
import { CloudflareAIService } from '../../services/cloudflare-ai.service';

describe('MapService — getResourceOptimization (MCLP proxy + cache)', () => {
  let service: MapService;
  let httpService: jest.Mocked<HttpService>;
  let mapServiceSpy: jest.SpyInstance;

  const mockPoIs = [
    { id: '1', name: 'Trường A', category: 'school', lat: 10.95, lng: 106.84, address: 'Đường 1', rating_avg: 4.5 },
    { id: '2', name: 'Thư viện B', category: 'library', lat: 10.92, lng: 106.82, address: 'Đường 2', rating_avg: 4.0 },
    { id: '3', name: 'Wifi C', category: 'wifi', lat: 10.98, lng: 106.88, address: 'Đường 3', rating_avg: 3.5 },
  ];

  const mockAiResponse = {
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [106.84, 10.95] },
          properties: { plan: 'C', facility_type: 'wifi', name: 'Site A', demand_served: 50, cost: 1500000 } },
      ],
      plans: {
        A: { selected: 1, total_cost: 1500000, total_served: 2, total_demand: 3, coverage_pct: 66.7, budget: 12000000, solver: 'scipy.milp' },
        B: { selected: 2, total_cost: 3000000, total_served: 3, total_demand: 3, coverage_pct: 100.0, budget: 21000000, solver: 'scipy.milp' },
        C: { selected: 2, total_cost: 3000000, total_served: 3, total_demand: 3, coverage_pct: 100.0, budget: 30000000, solver: 'scipy.milp' },
      },
      gaps: { type: 'FeatureCollection', features: [] },
      summary: { budget: 30000000, candidate_count: 3, demand_count: 3, pre_filtered: false, elapsed_ms: 42, best_plan: 'C' },
      status: 'success',
    },
  };

  beforeEach(async () => {
    const mockMapPointRepo = {
      query: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<MapPoint>>;

    const mockLocationRepo = {
      query: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Location>>;

    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
      axiosRef: {
        post: jest.fn(),
        get: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://127.0.0.1:8000'),
    };

    const mockCloudflare = {
      analyzeGeoDensity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapService,
        { provide: getRepositoryToken(MapPoint), useValue: mockMapPointRepo },
        { provide: getRepositoryToken(Location), useValue: mockLocationRepo },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CloudflareAIService, useValue: mockCloudflare },
      ],
    }).compile();

    service = module.get<MapService>(MapService);
    httpService = module.get(HttpService);

    // Spy on findAllPois to bypass DB complexity
    mapServiceSpy = jest.spyOn(service as any, 'findAllPois').mockResolvedValue(mockPoIs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch POIs and proxy to ai-service on cache miss', async () => {
    httpService.post.mockReturnValue(of(mockAiResponse as any));

    const result = await service.getResourceOptimization({ budget: 30_000_000 });

    // POIs fetched from DB
    expect(mapServiceSpy).toHaveBeenCalledTimes(1);
    // Proxied to ai-service
    expect(httpService.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/ai/resource/optimize',
      expect.objectContaining({
        budget: 30_000_000,
        demand_points: expect.arrayContaining([
          expect.objectContaining({ lat: 10.95, lng: 106.84 }),
        ]),
        candidate_locations: expect.any(Array),
      }),
      { timeout: 30000 },
    );
    // Result returned
    expect(result).toEqual(mockAiResponse.data);
  });

  it('should return cached result on second call with same params', async () => {
    httpService.post.mockReturnValue(of(mockAiResponse as any));

    // First call — cache miss, proxies to ai-service
    await service.getResourceOptimization({ budget: 30_000_000 });
    expect(httpService.post).toHaveBeenCalledTimes(1);

    // Second call — cache hit, should NOT call ai-service again
    const cachedResult = await service.getResourceOptimization({ budget: 30_000_000 });
    expect(httpService.post).toHaveBeenCalledTimes(1); // still 1, not 2
    expect(mapServiceSpy).toHaveBeenCalledTimes(1); // DB not queried again
    expect(cachedResult).toEqual(mockAiResponse.data);
  });

  it('should NOT return cached result for different budget values', async () => {
    httpService.post.mockReturnValue(of(mockAiResponse as any));

    await service.getResourceOptimization({ budget: 30_000_000 });
    await service.getResourceOptimization({ budget: 50_000_000 });

    // Different budgets → different cache keys → 2 ai-service calls
    expect(httpService.post).toHaveBeenCalledTimes(2);
  });

  it('should degrade gracefully when ai-service is down', async () => {
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 503, data: { detail: 'AI service unavailable' } },
        message: 'Service Unavailable',
      }))
    );

    const result = await service.getResourceOptimization({ budget: 30_000_000 });

    // Should return a valid fallback GeoJSON, not throw
    expect(result).toBeDefined();
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toEqual([]);
    expect(result.plans).toBeDefined();
    expect(result.plans.A).toBeDefined();
    expect(result.plans.C).toBeDefined();
    expect(result.status).toBe('degraded');
    expect(result.summary.note).toContain('AI service unavailable');
  });

  it('should include the correct request body fields', async () => {
    httpService.post.mockReturnValue(of(mockAiResponse as any));

    await service.getResourceOptimization({
      budget: 50_000_000,
      coverage_radius_km: 2.5,
      center_lat: 10.90,
      center_lng: 106.90,
      region_radius_km: 15,
    });

    const callArgs = (httpService.post as jest.Mock).mock.calls[0][1] as any;
    expect(callArgs.budget).toBe(50_000_000);
    expect(callArgs.coverage_radius_km).toBe(2.5);
    expect(callArgs.center).toEqual({ lat: 10.90, lng: 106.90 });
    expect(callArgs.region_radius_km).toBe(15);
    expect(callArgs.demand_points).toHaveLength(mockPoIs.length);
    expect(callArgs.candidate_locations).toHaveLength(mockPoIs.length);
  });
});

describe('MapService — nLSearch (Talk2Map Idea #4)', () => {
  let service: MapService;
  let httpService: jest.Mocked<HttpService>;

  const mockPoIs: PointOfInterest[] = [
    { id: '1', name: 'Thư viện ABC', category: 'library', lat: 10.95, lng: 106.84,
      address: 'Đường 1', description: 'Thư viện công cộng, có wifi, miễn phí', rating_avg: 4.5 },
    { id: '2', name: 'Trường XYZ', category: 'school', lat: 10.92, lng: 106.82,
      address: 'Đường 2', description: 'Trường THCS', rating_avg: 4.0 },
    { id: '3', name: 'Wifi Zone C', category: 'wifi', lat: 10.98, lng: 106.88,
      address: 'Đường 3', description: 'Điểm wifi công cộng', rating_avg: 3.5 },
    { id: '4', name: 'Cà phê D', category: 'cafe', lat: 10.91, lng: 106.80,
      address: 'Đường 4', description: 'Cà phê có wifi, bàn ghế', rating_avg: 4.2 },
  ];

  const mockParsedResponse = {
    data: {
      status: 'success',
      degraded: false,
      parsed_query: {
        location: 'Biên Hòa',
        radius_km: 5.0,
        facility_types: ['library'],
        conditions: ['wifi'],
        reference_location: null,
        confidence: 0.8,
        method: 'llm',
        suggestions: [],
        raw_text: 'Tìm thư viện có wifi',
      },
      explanation: 'Bạn muốn tìm thư viện gần đây có wifi.',
    },
  };

  beforeEach(async () => {
    const mockMapPointRepo = { query: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    const mockLocationRepo = { query: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    const mockHttpService = { post: jest.fn(), get: jest.fn(), axiosRef: { post: jest.fn(), get: jest.fn() } };
    const mockConfigService = { get: jest.fn().mockReturnValue('http://127.0.0.1:8000') };
    const mockCloudflare = { analyzeGeoDensity: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapService,
        { provide: getRepositoryToken(MapPoint), useValue: mockMapPointRepo },
        { provide: getRepositoryToken(Location), useValue: mockLocationRepo },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CloudflareAIService, useValue: mockCloudflare },
      ],
    }).compile();

    service = module.get<MapService>(MapService);
    httpService = module.get(HttpService);
    jest.spyOn(service as any, 'findAllPois').mockResolvedValue([...mockPoIs]);
    jest.spyOn(service as any, 'findPoisByCategory').mockImplementation(
      async (category: string) => mockPoIs.filter(p => p.category === category)
    );
    jest.spyOn(service as any, 'deduplicatePois').mockImplementation((pois: any[]) => pois);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call ai-service and return parsed query + filtered results', async () => {
    httpService.post.mockReturnValue(of(mockParsedResponse as any));

    const result = await service.nLSearch('Tìm thư viện có wifi', 20);

    // ai-service called with correct endpoint + payload
    expect(httpService.post).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/ai/map/query',
      { text: 'Tìm thư viện có wifi' },
      { timeout: 15000 }
    );

    // Results returned
    expect(result.query).toBe('Tìm thư viện có wifi');
    expect(result.parsed_query.facility_types).toEqual(['library']);
    expect(result.parsed_query.conditions).toEqual(['wifi']);
    expect(result.explanation).toBe('Bạn muốn tìm thư viện gần đây có wifi.');
    expect(result.degraded).toBe(false);
    expect(result.results).toBeDefined();
    expect(result.total).toBe(result.results.length);
  });

  it('should filter POIs by facility_types', async () => {
    httpService.post.mockReturnValue(of(mockParsedResponse as any));

    const result = await service.nLSearch('Tìm thư viện', 20);
    const categories = result.results.map(r => r.category);
    // Only library POIs should be in results (facility_types=["library"])
    expect(categories.every(c => c === 'library' || c === 'wifi')).toBe(true);
  });

  it('should filter POIs by conditions (wifi)', async () => {
    httpService.post.mockReturnValue(of(mockParsedResponse as any));

    const result = await service.nLSearch('Tìm thư viện có wifi', 20);
    // All results should have wifi in description or be wifi category
    for (const poi of result.results) {
      const desc = (poi.description || '').toLowerCase();
      expect(poi.category === 'wifi' || desc.includes('wifi') || desc.includes('internet')).toBe(true);
    }
  });

  it('should degrade gracefully when ai-service is down (regex fallback)', async () => {
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: { status: 503, data: { detail: 'AI service unavailable' } },
        message: 'Service Unavailable',
      }))
    );

    const result = await service.nLSearch('Tìm thư viện có wifi', 20);

    expect(result.degraded).toBe(true);
    expect(result.parsed_query.method).toBe('regex');
    expect(result.parsed_query.facility_types).toContain('library');
    expect(result.parsed_query.facility_types).toContain('wifi');
    expect(result.explanation).toContain('Tìm kiếm');
    expect(result.results).toBeDefined();
  });

  it('should return empty results with valid structure on DB error', async () => {
    httpService.post.mockReturnValue(of(mockParsedResponse as any));
    jest.spyOn(service as any, 'findAllPois').mockRejectedValue(new Error('DB down'));
    jest.spyOn(service as any, 'findPoisByCategory').mockRejectedValue(new Error('DB down'));

    const result = await service.nLSearch('Tìm thư viện', 20);

    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.parsed_query).toBeDefined();
    expect(result.explanation).toBeDefined();
  });

  it('should return all POIs when no facility_types detected', async () => {
    const noFacilityResponse = {
      data: {
        status: 'success',
        degraded: false,
        parsed_query: {
          facility_types: [],
          conditions: [],
          radius_km: 5.0,
          location: null,
          reference_location: 'trường',
          confidence: 0.5,
          method: 'regex',
          suggestions: [],
          raw_text: 'Tìm địa điểm gần trường',
        },
        explanation: 'Tìm địa điểm gần trường.',
      },
    };
    httpService.post.mockReturnValue(of(noFacilityResponse as any));

    const result = await service.nLSearch('Tìm địa điểm gần trường', 20);
    expect(result.results.length).toBe(mockPoIs.length);
  });
});
