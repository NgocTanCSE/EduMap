import { Controller, Get, Query, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { RoutingService, RouteRequest, RouteResponse, Route } from './routing.service';
import { FloodRoutingService, FloodZoneInfo } from './flood-routing.service';
import { TrafficRoutingService, TrafficAwareRoute, TrafficInfo } from './traffic-routing.service';

@Controller('map/routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly floodRoutingService: FloodRoutingService,
    private readonly trafficRoutingService: TrafficRoutingService,
  ) {}

  @Get('route')
  async getRoute(
    @Query('lng1') lng1: string,
    @Query('lat1') lat1: string,
    @Query('lng2') lng2: string,
    @Query('lat2') lat2: string,
    @Query('alternatives') alternatives?: string,
    @Query('steps') steps?: string,
    @Query('overview') overview?: 'full' | 'simplified' | 'false',
    @Query('avoidFlood') avoidFlood?: string,
    @Query('avoidTraffic') avoidTraffic?: string,
    @Query('date') date?: string,
  ) {
    try {
      const coords = {
        lng1: parseFloat(lng1),
        lat1: parseFloat(lat1),
        lng2: parseFloat(lng2),
        lat2: parseFloat(lat2),
      };

      if (Object.values(coords).some(isNaN)) {
        throw new BadRequestException('Invalid coordinates. All lng/lat must be valid numbers.');
      }

      const params: RouteRequest = {
        ...coords,
        alternatives: alternatives !== 'false',
        steps: steps !== 'false',
        overview: overview || 'full',
      };

      // Get base route from OSRM (direct OSRM response)
      const baseResult: RouteResponse = await this.routingService.getRoute(params);
      
      if (!baseResult.routes?.length) {
        return { success: false, message: 'No route found' };
      }

      const bestRoute: Route = baseResult.routes[0];
      const routeGeometry = bestRoute.geometry;

      // Check flood zones if requested
      let floodWarnings: FloodZoneInfo[] = [];
      let avoidedFloodZones: FloodZoneInfo[] = [];
      let finalGeometry = routeGeometry;
      let finalDuration = bestRoute.duration;
      let finalDistance = bestRoute.distance;

      const checkDate = date ? new Date(date) : new Date();

      if (avoidFlood !== 'false') {
        const floodCheck = await this.floodRoutingService.checkRouteForFloods(routeGeometry, checkDate);
        
        if (floodCheck.intersects) {
          floodWarnings = floodCheck.floodZones;
          
          // Try alternative routes that avoid flood zones
          const alternatives = baseResult.routes.slice(1);
          for (const altRoute of alternatives) {
            const altFloodCheck = await this.floodRoutingService.checkRouteForFloods(altRoute.geometry, checkDate);
            if (!altFloodCheck.intersects) {
              finalGeometry = altRoute.geometry;
              finalDuration = altRoute.duration;
              finalDistance = altRoute.distance;
              avoidedFloodZones = floodCheck.floodZones;
              break;
            }
          }
          
          // If no alternative avoids flood, use original but warn
          if (finalGeometry === routeGeometry && floodWarnings.length > 0) {
            avoidedFloodZones = floodCheck.floodZones;
          }
        }
      }

      // Analyze traffic if requested
      let trafficAnalysis: TrafficAwareRoute | null = null;
      if (avoidTraffic !== 'false') {
        trafficAnalysis = await this.trafficRoutingService.analyzeRouteTraffic(finalGeometry, checkDate);
        finalDuration = trafficAnalysis.duration;
      }

      // Build segments info
      const segments = bestRoute.legs?.[0]?.steps?.map((step: any) => ({
        name: step.name || 'Đoạn đường',
        duration: step.duration,
        distance: step.distance,
        congestionLevel: trafficAnalysis?.trafficSegments.find(t => 
          Math.abs(t.estimatedSpeed * (step.duration / 60) - step.duration) < 30
        )?.congestionLevel || 0,
      })) || [];

      return { 
        success: true, 
        data: {
          code: baseResult.code,
          routes: [{
            geometry: finalGeometry,
            legs: [{
              steps: bestRoute.legs?.[0]?.steps || [],
              summary: bestRoute.legs?.[0]?.summary || '',
              weight: bestRoute.weight,
              duration: finalDuration,
              distance: finalDistance,
            }],
            weight_name: bestRoute.weight_name,
            weight: bestRoute.weight,
            duration: finalDuration,
            distance: finalDistance,
          }],
          waypoints: baseResult.waypoints,
          floodWarnings,
          avoidedFloodZones,
          trafficAnalysis: trafficAnalysis ? {
            totalDelay: trafficAnalysis.totalDelay,
            congestionSummary: trafficAnalysis.congestionSummary,
            segments: trafficAnalysis.trafficSegments.map(t => ({
              roadName: t.roadName,
              roadType: t.roadType,
              congestionLevel: t.congestionLevel,
              congestionLabel: this.trafficRoutingService.getCongestionLabel(t.congestionLevel),
              congestionColor: this.trafficRoutingService.getCongestionColor(t.congestionLevel),
              estimatedSpeed: Math.round(t.estimatedSpeed),
              freeFlowSpeed: t.freeFlowSpeed,
            })),
          } : null,
          segments,
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Routing failed: ${error.message}`);
    }
  }

  @Get('flood-zones')
  async getActiveFloodZones(@Query('date') date?: string) {
    try {
      const checkDate = date ? new Date(date) : new Date();
      const zones = await this.floodRoutingService.getActiveFloodZones(checkDate);
      
      return {
        success: true,
        data: zones.map(z => ({
          id: z.id,
          name: z.name,
          riskLevel: z.riskLevel,
          coordinates: z.coordinates,
          metadata: z.metadata,
        })),
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to get flood zones: ${error.message}`);
    }
  }

  @Get('traffic-segments')
  async getTrafficSegments(@Query('bounds') bounds?: string) {
    try {
      return { success: true, data: [] };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to get traffic segments: ${error.message}`);
    }
  }

  @Get('nearest')
  async getNearestRoad(
    @Query('lng') lng: string,
    @Query('lat') lat: string,
  ) {
    try {
      const longitude = parseFloat(lng);
      const latitude = parseFloat(lat);

      if (isNaN(longitude) || isNaN(latitude)) {
        throw new BadRequestException('Invalid coordinates');
      }

      const result = await this.routingService.getNearestRoad(longitude, latitude);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Nearest road failed: ${error.message}`);
    }
  }

  @Get('table')
  async getDistanceTable(
    @Query('sources') sources: string,
    @Query('destinations') destinations: string,
  ) {
    try {
      if (!sources || !destinations) {
        throw new BadRequestException('Sources and destinations are required');
      }

      const srcCoords = sources.split(';').map(s => {
        const [lng, lat] = s.split(',').map(parseFloat);
        if (isNaN(lng) || isNaN(lat)) throw new Error('Invalid source coordinate');
        return [lng, lat] as [number, number];
      });

      const dstCoords = destinations.split(';').map(s => {
        const [lng, lat] = s.split(',').map(parseFloat);
        if (isNaN(lng) || isNaN(lat)) throw new Error('Invalid destination coordinate');
        return [lng, lat] as [number, number];
      });

      const result = await this.routingService.getTable(srcCoords, dstCoords);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Distance table failed: ${error.message}`);
    }
  }
}