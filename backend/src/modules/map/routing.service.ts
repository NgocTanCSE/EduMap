import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { FloodRoutingService } from './flood-routing.service';
import { TrafficRoutingService, TrafficAwareRoute } from './traffic-routing.service';
export interface RouteRequest {
    lng1: number;
    lat1: number;
    lng2: number;
    lat2: number;
    alternatives?: boolean;
    steps?: boolean;
    overview?: 'full' | 'simplified' | 'false';
}
export interface RouteResponse {
    code: string;
    routes: Route[];
    waypoints: Waypoint[];
}
export interface Route {
    geometry: string;
    legs: RouteLeg[];
    weight_name: string;
    weight: number;
    duration: number;
    distance: number;
}
export interface RouteLeg {
    steps: RouteStep[];
    summary: string;
    weight: number;
    duration: number;
    distance: number;
}
export interface RouteStep {
    geometry: string;
    maneuver: Maneuver;
    name: string;
    duration: number;
    distance: number;
    intersections: Intersection[];
}
export interface Maneuver {
    type: string;
    modifier: string;
    bearing_before: number;
    bearing_after: number;
    location: [
        number,
        number
    ];
    instruction: string;
}
export interface Intersection {
    location: [
        number,
        number
    ];
    bearings: number[];
    entry: boolean[];
    in: number;
    out: number;
}
export interface Waypoint {
    name: string;
    location: [
        number,
        number
    ];
    hint: string;
}
export type Coord = [
    number,
    number
];
export interface SafeRoutePreferences {
    avoidFlood: boolean;
    avoidTraffic: boolean;
    preferPaved?: boolean;
    maxDistanceKm?: number;
    safetyWeight?: number;
}
export interface SafetyFactors {
    distanceScore: number;
    durationScore: number;
    floodRisk: number;
    trafficRisk: number;
}
export interface SafeRouteWithScore extends Route {
    safetyScore: number;
    safetyFactors: SafetyFactors;
    explanation: string;
    isPrimary: boolean;
    trafficAnalysis?: {
        totalDelay: number;
        congestionSummary: TrafficAwareRoute['congestionSummary'];
    };
    floodWarnings: {
        id: string;
        name: string;
        riskLevel: string;
    }[];
}
export interface SafeRouteResult {
    routes: SafeRouteWithScore[];
    bestRouteIndex: number;
    origin: Coord;
    destination: Coord;
    preferences: SafeRoutePreferences;
    estimated: boolean;
    provider: string;
}
function orsToOsmType(orsType: string): string {
    const map: Record<string, string> = {
        '0_unclassified': '0',
        '0_secondary': '0',
        '0_motorway': '0',
        '0_tertiary': '0',
        '0_residential': '0',
        '1_left_turn': 'turn',
        '1_right_turn': 'turn',
        '2_left_turn': 'turn',
        '2_right_turn': 'turn',
        '1_straight_road': '0',
        '1_turn_left': 'turn left',
        '1_turn_right': 'turn right',
        '1_turn_right_sharper': 'turn right',
        '1_turn_left_sharper': 'turn left',
        '1_turn_right_dangerous': 'turn right',
        '1_turn_left_dangerous': 'turn left',
        '1_fork_right': 'fork',
        '1_fork_left': 'fork',
        '1_roundabout': 'roundabout',
    };
    if (orsType.startsWith('1_')) {
        const base = orsType.split('_')[1];
        return base;
    }
    return '0';
}
@Injectable()
export class RoutingService {
    private readonly logger = new Logger(RoutingService.name);
    private readonly orsUrl: string;
    private readonly orsApiKey: string | undefined;
    private readonly osrmUrl: string | undefined;
    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService, private readonly floodRoutingService: FloodRoutingService, private readonly trafficRoutingService: TrafficRoutingService) {
        this.orsUrl = this.configService.get<string>('ORS_URL') || 'https://api.openrouteservice.org';
        this.orsApiKey = this.configService.get<string>('ORS_API_KEY');
        this.osrmUrl = this.configService.get<string>('OSRM_URL');
    }
    private translateOrsToRouteResponse(orsFile: any): RouteResponse {
        const orsRoutes: any[] = orsFile?.features?.length
            ? orsFile.features.map((f: any) => ({
                geometry: f.geometry || f.properties?.geometry || {},
                segments: f.properties?.segments || [],
                summary: f.properties?.summary || {},
            }))
            : orsFile?.routes || [];
        const routes: Route[] = orsRoutes.map((orsRoute: any) => ({
            geometry: JSON.stringify(orsRoute.geometry || ''),
            legs: (orsRoute.segments || []).map((seg: any) => ({
                steps: (seg.steps || []).map((step: any) => ({
                    geometry: JSON.stringify(step.geometry || ''),
                    maneuver: {
                        type: orsToOsmType(step.instruction?.text || step.instruction || '') || '0',
                        modifier: step.modifier || '',
                        bearing_before: step.bearing_before || 0,
                        bearing_after: step.bearing_after || 0,
                        location: step.location || [0, 0],
                        instruction: step.instruction?.text || step.instruction || '',
                    },
                    name: step.name || '',
                    duration: step.duration || 0,
                    distance: step.distance || 0,
                    intersections: [],
                } as RouteStep)),
                summary: '',
                weight: 0,
                duration: seg.duration || 0,
                distance: seg.distance || 0,
            } as RouteLeg)),
            weight_name: 'duration',
            weight: orsRoute.summary?.duration || orsRoute.duration || 0,
            duration: orsRoute.summary?.duration || orsRoute.duration || 0,
            distance: orsRoute.summary?.distance || orsRoute.distance || 0,
        }));
        const waypoints: Waypoint[] = (orsFile?.waypoints ||
            orsFile?.features?.[0]?.properties?.waypoints ||
            []).map((wp: any) => ({
            name: wp.name || '',
            location: wp.location || [0, 0],
            hint: '',
        }));
        return {
            code: 'Ok',
            routes,
            waypoints,
        };
    }
    async getRoute(params: RouteRequest): Promise<RouteResponse> {
        const { lng1, lat1, lng2, lat2, alternatives = true, steps = true, overview = 'full' } = params;
        if (this.osrmUrl) {
            try {
                const url = `${this.osrmUrl}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}` +
                    `?overview=${overview === 'false' ? 'false' : overview}` +
                    `&steps=${steps}&alternatives=${alternatives}`;
                const response = await firstValueFrom(this.httpService.get(url, { timeout: 15000 }));
                const data = response.data;
                if (data?.code === 'Ok' && data.routes?.length > 0) {
                    this.logger.log(`Local OSRM returned ${data.routes.length} route(s)`);
                    return {
                        code: data.code,
                        routes: data.routes.map((r: any) => ({
                            ...r,
                            geometry: typeof r.geometry === 'string' ? r.geometry : JSON.stringify(r.geometry),
                        })),
                        waypoints: data.waypoints || [],
                    };
                }
                this.logger.warn(`OSRM returned no routes (code=${data?.code}) — trying next provider`);
            }
            catch (error: any) {
                this.logger.error(`OSRM routing error: ${error.message}`);
            }
        }
        if (this.orsApiKey) {
            try {
                const body: Record<string, any> = {
                    coordinates: [[lng1, lat1], [lng2, lat2]],
                    instructions: steps,
                    geometry_simplify: overview === 'simplified',
                };
                if (alternatives) {
                    body.alternative_routes = { target_count: 2, share_factor: 0.6, weight_factor: 1.6 };
                }
                const response = await firstValueFrom(this.httpService.post(`${this.orsUrl}/v2/directions/driving-car/geojson`, body, {
                    timeout: 15000,
                    headers: {
                        'Authorization': this.orsApiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, application/geo+json',
                    },
                }));
                const translated = this.translateOrsToRouteResponse(response.data);
                if (translated.routes.length > 0) {
                    this.logger.log(`OpenRouteService returned ${translated.routes.length} route(s)`);
                    return translated;
                }
                this.logger.warn('OpenRouteService returned no routes — trying next provider');
            }
            catch (error: any) {
                this.logger.error(`OpenRouteService routing error: ${error.message}`);
            }
        }
        this.logger.warn('No routing provider available — using straight-line fallback route');
        return this.fallbackRoute(lng1, lat1, lng2, lat2);
    }
    private fallbackRoute(lng1: number, lat1: number, lng2: number, lat2: number): RouteResponse {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const distance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
        const duration = distance / 13.9;
        return {
            code: 'haversine_fallback',
            routes: [{
                    geometry: JSON.stringify({ type: 'LineString', coordinates: [[lng1, lat1], [lng2, lat2]] }),
                    legs: [{
                            steps: [],
                            summary: '',
                            weight: duration,
                            duration,
                            distance,
                        }],
                    weight_name: 'duration',
                    weight: duration,
                    duration,
                    distance,
                }],
            waypoints: [
                { name: '', location: [lng1, lat1] as [
                        number,
                        number
                    ], hint: '0' },
                { name: '', location: [lng2, lat2] as [
                        number,
                        number
                    ], hint: '0' },
            ],
        };
    }
    async getRouteWithAlternatives(params: RouteRequest): Promise<RouteResponse> {
        return this.getRoute({ ...params, alternatives: true });
    }
    async getNearestRoad(lng: number, lat: number): Promise<{
        name: string;
        location: [
            number,
            number
        ];
    }> {
        return { name: 'Nearest point', location: [lng, lat] };
    }
    async getTable(sources: [
        number,
        number
    ][], destinations: [
        number,
        number
    ][], annotations?: ('duration' | 'distance' | 'speed')[]): Promise<any> {
        if (!this.orsApiKey) {
            this.logger.warn('ORS_API_KEY not configured — returning minimal table response');
            const n = sources.length;
            const m = destinations.length;
            const durations = Array(n).fill(0).map(() => Array(m).fill(0));
            const distances = Array(n).fill(0).map(() => Array(m).fill(0));
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < m; j++) {
                    const [lng1, lat1] = sources[i];
                    const [lng2, lat2] = destinations[j];
                    const R = 6371000;
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLng = (lng2 - lng1) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                    const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
                    distances[i][j] = dist;
                    durations[i][j] = dist / 13.9;
                }
            }
            return { distances, durations };
        }
        const coords = [...sources, ...destinations].map(([lng, lat]) => `${lng},${lat}`).join('|');
        const url = `${this.orsUrl}/v2/matrix?start=${sources.map(([lng, lat]) => `${lng},${lat}`).join(';')}`;
        try {
            const response = await firstValueFrom(this.httpService.get<any>(`${this.orsUrl}/v2/matrix`, {
                method: 'POST' as const,
                url: `${this.orsUrl}/v2/matrix`,
                data: {
                    locations: [...sources, ...destinations].map(([lng, lat]) => [lng, lat]),
                    sources: sources.map((_, i) => i),
                    destinations: destinations.map((_, i) => sources.length + i),
                    metrics: annotations || ['duration', 'distance'],
                },
                headers: {
                    'Authorization': this.orsApiKey,
                    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf8',
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }));
            return response.data;
        }
        catch (error: any) {
            this.logger.error(`OpenRouteService matrix error: ${error.message}`);
            const n = sources.length;
            const m = destinations.length;
            return {
                distances: Array(n).fill(0).map(() => Array(m).fill(0)),
                durations: Array(n).fill(0).map(() => Array(m).fill(0)),
            };
        }
    }
    async safeRoute(origin: Coord, destination: Coord, preferences: SafeRoutePreferences): Promise<SafeRouteResult> {
        const w = preferences.safetyWeight ?? 0.3;
        const baseResult = await this.getRoute({
            lng1: origin[0], lat1: origin[1],
            lng2: destination[0], lat2: destination[1],
            alternatives: true,
            steps: true,
            overview: 'full',
        });
        const routes = baseResult.routes || [];
        const provider = baseResult.code === 'haversine_fallback' ? 'haversine' : 'ors_or_osrm';
        const estimated = provider === 'haversine';
        const scored: SafeRouteWithScore[] = await Promise.all(routes.map(async (route, idx) => {
            const geometry = this.parseRouteGeometry(route.geometry);
            let floodRisk = 0;
            let floodWarnings: SafeRouteWithScore['floodWarnings'] = [];
            if (preferences.avoidFlood && geometry) {
                try {
                    const flood = await this.floodRoutingService.checkRouteForFloods(geometry);
                    const zoneCount = flood?.floodZones?.length || 0;
                    floodRisk = Math.min(100, zoneCount * 25);
                    floodWarnings = (flood?.floodZones || []).map(z => ({
                        id: z.id, name: z.name, riskLevel: z.riskLevel,
                    }));
                }
                catch (e) {
                    this.logger.warn(`Flood check failed for route ${idx}: ${(e as Error).message}`);
                }
            }
            let trafficRisk = 0;
            let trafficAnalysis: SafeRouteWithScore['trafficAnalysis'];
            if (preferences.avoidTraffic && geometry) {
                try {
                    const traffic: TrafficAwareRoute = await this.trafficRoutingService.analyzeRouteTraffic(geometry);
                    if (traffic && traffic.congestionSummary) {
                        const { free, light, moderate, heavy } = traffic.congestionSummary;
                        const total = free + light + moderate + heavy || 1;
                        trafficRisk = Math.min(100, (heavy * 30 + moderate * 15 + light * 5) / total * 100 / 100);
                        trafficRisk = Math.round(trafficRisk);
                        trafficAnalysis = {
                            totalDelay: traffic.totalDelay,
                            congestionSummary: traffic.congestionSummary,
                        };
                    }
                }
                catch (e) {
                    this.logger.warn(`Traffic analysis failed for route ${idx}: ${(e as Error).message}`);
                }
            }
            return {
                ...route,
                geometry: typeof route.geometry === 'string' ? route.geometry : JSON.stringify(route.geometry),
                safetyScore: 0,
                safetyFactors: {
                    distanceScore: 0,
                    durationScore: 0,
                    floodRisk,
                    trafficRisk,
                },
                explanation: this.buildRouteExplanation(route, floodRisk, trafficRisk),
                isPrimary: false,
                trafficAnalysis,
                floodWarnings,
            };
        }));
        const maxDist = Math.max(...scored.map(r => r.distance || 1));
        const maxDur = Math.max(...scored.map(r => r.duration || 1));
        for (const r of scored) {
            r.safetyFactors.distanceScore = maxDist > 0
                ? Math.round((1 - (r.distance || 0) / maxDist) * 100) : 100;
            r.safetyFactors.durationScore = maxDur > 0
                ? Math.round((1 - (r.duration || 0) / maxDur) * 100) : 100;
        }
        const wFlood = 0.5;
        const wTraffic = 0.5;
        for (const r of scored) {
            const safetyComponent = 100 - (wFlood * r.safetyFactors.floodRisk + wTraffic * r.safetyFactors.trafficRisk);
            const speedComponent = (0.5 * r.safetyFactors.distanceScore + 0.5 * r.safetyFactors.durationScore);
            r.safetyScore = Math.round(w * safetyComponent + (1 - w) * speedComponent);
        }
        if (preferences.maxDistanceKm && scored.length > 1) {
            const maxDistM = preferences.maxDistanceKm * 1000;
            const withinLimit = scored.filter(r => (r.distance || 0) <= maxDistM);
            if (withinLimit.length > 0) {
                scored.length = 0;
                scored.push(...withinLimit);
            }
            else {
                scored.sort((a, b) => (a.distance || 0) - (b.distance || 0));
                const shortest = scored[0];
                scored.length = 0;
                scored.push(shortest);
            }
        }
        scored.sort((a, b) => b.safetyScore - a.safetyScore);
        if (scored.length > 0)
            scored[0].isPrimary = true;
        return {
            routes: scored,
            bestRouteIndex: 0,
            origin,
            destination,
            preferences,
            estimated,
            provider,
        };
    }
    private parseRouteGeometry(geom: string | any): any {
        if (!geom)
            return null;
        if (typeof geom === 'string') {
            try {
                return JSON.parse(geom);
            }
            catch {
                return null;
            }
        }
        if (typeof geom === 'object') {
            if (geom.type)
                return geom;
            if (Array.isArray(geom) && geom[0]?.length === 2) {
                return { type: 'LineString', coordinates: geom };
            }
        }
        return null;
    }
    private buildRouteExplanation(route: Route, floodRisk: number, trafficRisk: number): string {
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.round(route.duration / 60);
        let parts: string[] = [];
        if (floodRisk > 0) {
            parts.push(`ngập lũ (${floodRisk}% rủi ro)`);
        }
        if (trafficRisk > 0) {
            parts.push(`tắc nghẽn (${trafficRisk}% rủi ro)`);
        }
        const riskPart = parts.length > 0 ? ` — rủi ro: ${parts.join(', ')}` : '';
        return `Quãng đường ${distKm} km, khoảng ${durMin} phút${riskPart}.`;
    }
}
