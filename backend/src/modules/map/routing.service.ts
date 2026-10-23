import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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
  location: [number, number];
  instruction: string;
}

export interface Intersection {
  location: [number, number];
  bearings: number[];
  entry: boolean[];
  in: number;
  out: number;
}

export interface Waypoint {
  name: string;
  location: [number, number];
  hint: string;
}

/**
 * Map OpenRouteService step types to OSRM-style maneuver types.
 */
function orsToOsmType(orsType: string): string {
  const map: Record<string, string> = {
    '0_unclassified': '0',
    '0_secondary': '0',
    '0_motorway': '0',
    '0_tertiary': '0',
    '0_residential': '0',
    '1_left_turn': 'turn',
    '1_right_turn': 'turn',
    '2_left_turn' : 'turn',
    '2_right_turn': 'turn',
    // Default: straight / continue
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
  // ORS uses instruction like "0_unclassified", "1_turn_left", etc.
  // Map to simple OSRM-style types
  if (orsType.startsWith('1_')) {
    const base = orsType.split('_')[1]; // e.g. "turn_left"
    return base;
  }
  return '0'; // straight
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly orsUrl: string;
  private readonly orsApiKey: string | undefined;
  private readonly osrmUrl: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.orsUrl = this.configService.get<string>('ORS_URL') || 'https://api.openrouteservice.org';
    this.orsApiKey = this.configService.get<string>('ORS_API_KEY');
    this.osrmUrl = this.configService.get<string>('OSRM_URL');
  }

  /**
   * Convert OpenRouteService route response to the legacy OSRM-compatible RouteResponse.
   * This lets the frontend unchanged while migrating from OSRM to OpenRouteService.
   */
  private translateOrsToRouteResponse(orsFile: any): RouteResponse {
    // Accept both response shapes:
    //  • legacy: { routes: [...] }  (segments/summary at the route level)
    //  • POST /v2/directions/{profile}/geojson (current ORS API): GeoJSON
    //    FeatureCollection with features[].geometry and
    //    features[].properties.{summary,segments,waypoints}
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
            // GeoJSON instructions carry `instruction` as a plain string
            // (e.g. "turn-left"); the legacy shape nested it under .text.
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

    const waypoints: Waypoint[] = (
      orsFile?.waypoints ||
      orsFile?.features?.[0]?.properties?.waypoints ||
      []
    ).map((wp: any) => ({
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

  /**
   * Route with a provider chain, always ending in a usable RouteResponse:
   *   1. OpenRouteService — the modern POST /v2/directions/{profile}/geojson
   *      endpoint. The previously used `GET /v2/directions?start=&end=` is
   *      DEPRECATED by ORS: newer API keys get a 2xx response whose body has
   *      no `routes`, which surfaced to users as the controller error
   *      "No route found" even though the request looked healthy (200, 500ms).
   *   2. Any OSRM-compatible server via OSRM_URL (Docker Compose `osrm`
   *      container locally; skipped on HF when the host is unreachable).
   *   3. Straight-line fallback so the map still draws a route in degraded
   *      conditions instead of failing the whole feature.
   */
  async getRoute(params: RouteRequest): Promise<RouteResponse> {
    const { lng1, lat1, lng2, lat2, alternatives = true, steps = true, overview = 'full' } = params;

    // ── 1. OpenRouteService (modern POST geojson API) ──
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
        const response = await firstValueFrom(
          this.httpService.post(
            `${this.orsUrl}/v2/directions/driving-car/geojson`,
            body,
            {
              timeout: 15000,
              headers: {
                'Authorization': this.orsApiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/geo+json',
              },
            },
          )
        );
        const translated = this.translateOrsToRouteResponse(response.data);
        if (translated.routes.length > 0) {
          this.logger.log(`OpenRouteService returned ${translated.routes.length} route(s)`);
          return translated;
        }
        this.logger.warn('OpenRouteService returned no routes — trying next provider');
      } catch (error: any) {
        this.logger.error(`OpenRouteService routing error: ${error.message}`);
      }
    }

    // ── 2. OSRM-compatible server (local container in Docker Compose) ──
    if (this.osrmUrl) {
      try {
        const url =
          `${this.osrmUrl}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}` +
          `?overview=${overview === 'false' ? 'false' : overview}` +
          `&steps=${steps}&alternatives=${alternatives}`;
        const response = await firstValueFrom(
          this.httpService.get(url, { timeout: 15000 })
        );
        const data = response.data;
        if (data?.code === 'Ok' && data.routes?.length > 0) {
          this.logger.log(`OSRM returned ${data.routes.length} route(s)`);
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
      } catch (error: any) {
        this.logger.error(`OSRM routing error: ${error.message}`);
      }
    }

    // ── 3. Graceful straight-line fallback (route still rendered) ──
    this.logger.warn('No routing provider available — using straight-line fallback route');
    return this.fallbackRoute(lng1, lat1, lng2, lat2);
  }

  /** Fallback: return a straight-line route using Haversine */
  private fallbackRoute(lng1: number, lat1: number, lng2: number, lat2: number): RouteResponse {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    const distance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
    const duration = distance / 13.9; // assume 50 km/h average speed

    return {
      code: 'Ok',
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
        { name: '', location: [lng1, lat1] as [number, number], hint: '0' },
        { name: '', location: [lng2, lat2] as [number, number], hint: '0' },
      ],
    };
  }

  async getRouteWithAlternatives(params: RouteRequest): Promise<RouteResponse> {
    return this.getRoute({ ...params, alternatives: true });
  }

  async getNearestRoad(lng: number, lat: number): Promise<{ name: string; location: [number, number] }> {
    // OpenRouteService doesn't have a nearest-road endpoint in the public API.
    // Return the input coordinates as a fallback.
    return { name: 'Nearest point', location: [lng, lat] };
  }

  async getTable(
    sources: [number, number][],
    destinations: [number, number][],
    annotations?: ('duration' | 'distance' | 'speed')[]
  ): Promise<any> {
    if (!this.orsApiKey) {
      this.logger.warn('ORS_API_KEY not configured — returning minimal table response');
      // Fallback: simple Haversine distance matrix
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
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
          const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
          distances[i][j] = dist;
          durations[i][j] = dist / 13.9;
        }
      }
      return { distances, durations };
    }

    const coords = [...sources, ...destinations].map(([lng, lat]) => `${lng},${lat}`).join('|');
    const url = `${this.orsUrl}/v2/matrix?start=${sources.map(([lng, lat]) => `${lng},${lat}`).join(';')}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(
          `${this.orsUrl}/v2/matrix`,
          {
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
          }
        )
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`OpenRouteService matrix error: ${error.message}`);
      // Return empty matrix as fallback
      const n = sources.length;
      const m = destinations.length;
      return {
        distances: Array(n).fill(0).map(() => Array(m).fill(0)),
        durations: Array(n).fill(0).map(() => Array(m).fill(0)),
      };
    }
  }
}
