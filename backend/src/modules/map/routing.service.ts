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

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly osrmUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Use public OSRM demo server as fallback for testing
    this.osrmUrl = this.configService.get<string>('OSRM_URL') || 'https://router.project-osrm.org';
  }

  async getRoute(params: RouteRequest): Promise<RouteResponse> {
    const { lng1, lat1, lng2, lat2, alternatives = true, steps = true, overview = 'full' } = params;
    
    const coordinates = `${lng1},${lat1};${lng2},${lat2}`;
    const url = `${this.osrmUrl}/route/v1/driving/${coordinates}`;
    
    const queryParams = new URLSearchParams({
      alternatives: alternatives.toString(),
      steps: steps.toString(),
      overview: overview,
      geometries: 'geojson',
    });

    try {
      this.logger.log(`Requesting route from OSRM: ${url}?${queryParams}`);
      
      const response = await firstValueFrom(
        this.httpService.get<RouteResponse>(`${url}?${queryParams}`, {
          timeout: 15000,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`OSRM routing error: ${error.message}`);
      throw new Error(`Failed to get route: ${error.message}`);
    }
  }

  async getRouteWithAlternatives(params: RouteRequest): Promise<RouteResponse> {
    return this.getRoute({ ...params, alternatives: true });
  }

  async getNearestRoad(lng: number, lat: number): Promise<{ name: string; location: [number, number] }> {
    const url = `${this.osrmUrl}/nearest/v1/driving/${lng},${lat}`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 5000 })
      );
      
      const waypoint = response.data.waypoints?.[0];
      if (waypoint) {
        return {
          name: waypoint.name || 'Unknown road',
          location: waypoint.location,
        };
      }
      throw new Error('No nearest road found');
    } catch (error) {
      this.logger.error(`OSRM nearest error: ${error.message}`);
      throw new Error(`Failed to find nearest road: ${error.message}`);
    }
  }

  async getTable(
    sources: [number, number][],
    destinations: [number, number][],
    annotations?: ('duration' | 'distance' | 'speed')[]
  ): Promise<any> {
    const coords = [...sources, ...destinations]
      .map(([lng, lat]) => `${lng},${lat}`)
      .join(';');
    
    const url = `${this.osrmUrl}/table/v1/driving/${coords}`;
    const queryParams = new URLSearchParams({
      sources: sources.map((_, i) => i).join(';'),
      destinations: destinations.map((_, i) => sources.length + i).join(';'),
      annotations: annotations?.join(',') || 'duration,distance',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${url}?${queryParams}`, { timeout: 15000 })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`OSRM table error: ${error.message}`);
      throw new Error(`Failed to get distance matrix: ${error.message}`);
    }
  }
}