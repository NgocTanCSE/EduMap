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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.orsUrl = this.configService.get<string>('ORS_URL') || 'https://api.openrouteservice.org';
    this.orsApiKey = this.configService.get<string>('ORS_API_KEY');
  }

  /**
   * Convert OpenRouteService route response to the legacy OSRM-compatible RouteResponse.
   * This lets the frontend unchanged while migrating from OSRM to OpenRouteService.
   */
  private translateOrsToRouteResponse(orsData: any): RouteResponse {
    const routes: Route[] = (orsData.routes || []).map((orsRoute: any) => ({
      geometry: JSON.stringify(orsRoute.geometry || orsRoute.summary?.geometry || ''),
      legs: (orsRoute.segments || []).map((seg: any) => ({
        steps: (seg.steps || []).map((step: any) => ({
          geometry: JSON.stringify(step.geometry || ''),
          maneuver: {
            type: orsToOsmType(step.instruction?.text || '') || '0',
            modifier: step.modifier || '',
            bearing_before: step.bearing_before || 0,
            bearing_after: step.bearing_after || 0,
            location: step.location || [0, 0],
            instruction: step.instruction?.text || '',
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
      duration: orsRoute.summary?.duration || 0,
      distance: orsRoute.summary?.distance || 0,
    }));

    const waypoints: Waypoint[] = (orsData.waypoints || []).map((wp: any) => ({
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

    if (!this.orsApiKey) {
      this.logger.warn('ORS_API_KEY not configured — returning minimal route response');
      return this.fallbackRoute(lng1, lat1, lng2, lat2);
    }

    const start = `${lng1},${lat1}`;
    const end = `${lng2},${lat2}`;
    const url = `${this.orsUrl}/v2/directions/driving-car?start=${start}&end=${end}&alternatives=${alternatives}&instructions=${steps}&geometry=${overview !== 'false'}`;

    try {
      this.logger.log(`Requesting route from OpenRouteService`);

      const response = await firstValueFrom(
        this.httpService.get<RouteResponse>(url, {
          timeout: 15000,
          headers: {
            'Authorization': this.orsApiKey,
            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf8',
          },
        })
      );

      return this.translateOrsToRouteResponse(response.data);
    } catch (error: any) {
      this.logger.error(`OpenRouteService routing error: ${error.message}`);
      return this.fallbackRoute(lng1, lat1, lng2, lat2);
    }
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
