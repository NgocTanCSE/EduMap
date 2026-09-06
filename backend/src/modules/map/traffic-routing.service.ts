import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrafficSegment } from './entities/traffic-segment.entity';

export interface TrafficInfo {
  segmentId: string;
  roadName: string;
  roadType: string;
  congestionLevel: number;
  currentSpeedFactor: number;
  freeFlowSpeed: number;
  estimatedSpeed: number;
}

export interface TrafficAwareRoute {
  geometry: any;
  duration: number;
  distance: number;
  trafficSegments: TrafficInfo[];
  totalDelay: number; // seconds
  congestionSummary: {
    free: number;
    light: number;
    moderate: number;
    heavy: number;
  };
}

@Injectable()
export class TrafficRoutingService {
  private readonly logger = new Logger(TrafficRoutingService.name);

  // Default speed factors by road type (km/h)
  private readonly defaultFreeFlowSpeeds: Record<string, number> = {
    motorway: 100,
    trunk: 80,
    primary: 60,
    secondary: 50,
    tertiary: 40,
    residential: 30,
    service: 20,
    unclassified: 30,
  };

  // Peak hour profiles (hourly speed factor 0-1)
  private readonly peakHourProfiles: Record<string, number[]> = {
    // Morning peak 7-9, Evening peak 17-19
    motorway: [0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.85,0.9,0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.8,0.9,0.95,0.95],
    trunk: [0.95,0.95,0.95,0.95,0.95,0.9,0.65,0.55,0.65,0.8,0.85,0.9,0.9,0.9,0.9,0.9,0.85,0.65,0.55,0.65,0.75,0.85,0.9,0.95],
    primary: [0.9,0.9,0.9,0.9,0.9,0.85,0.6,0.5,0.6,0.75,0.8,0.85,0.85,0.85,0.85,0.85,0.8,0.6,0.5,0.6,0.7,0.8,0.85,0.9],
    secondary: [0.9,0.9,0.9,0.9,0.9,0.85,0.6,0.5,0.6,0.75,0.8,0.85,0.85,0.85,0.85,0.85,0.8,0.6,0.5,0.6,0.7,0.8,0.85,0.9],
    tertiary: [0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.85,0.9,0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.8,0.9,0.95,0.95],
    residential: [0.95,0.95,0.95,0.95,0.95,0.9,0.75,0.65,0.75,0.85,0.9,0.95,0.95,0.95,0.95,0.95,0.9,0.75,0.65,0.75,0.85,0.9,0.95,0.95],
    service: [0.95,0.95,0.95,0.95,0.95,0.9,0.8,0.7,0.8,0.9,0.95,0.95,0.95,0.95,0.95,0.95,0.9,0.8,0.7,0.8,0.9,0.95,0.95,0.95],
    unclassified: [0.95,0.95,0.95,0.95,0.95,0.9,0.75,0.65,0.75,0.85,0.9,0.95,0.95,0.95,0.95,0.95,0.9,0.75,0.65,0.75,0.85,0.9,0.95,0.95],
  };

  // Weekend profile (less traffic)
  private readonly weekendFactor = 1.15;

  constructor(
    @InjectRepository(TrafficSegment)
    private readonly trafficSegmentRepo: Repository<TrafficSegment>,
  ) {}

  async analyzeRouteTraffic(routeGeometry: any, date?: Date): Promise<TrafficAwareRoute> {
    if (!routeGeometry || routeGeometry.type !== 'LineString') {
      return this.emptyRoute();
    }

    const checkDate = date || new Date();
    const hour = checkDate.getHours();
    const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const routeCoords = routeGeometry.coordinates;
    const trafficSegments: TrafficInfo[] = [];
    let totalDelay = 0;
    const congestionSummary = { free: 0, light: 0, moderate: 0, heavy: 0 };

    // For each route segment, estimate traffic
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const p1 = routeCoords[i];
      const p2 = routeCoords[i + 1];
      
      // Find nearest traffic segment or use heuristic
      const trafficInfo = await this.estimateSegmentTraffic(p1, p2, hour, isWeekend);
      trafficSegments.push(trafficInfo);

      // Calculate delay
      const segmentLength = this.haversineDistance(p1[1], p1[0], p2[1], p2[0]); // meters
      const freeFlowTime = (segmentLength / 1000) / trafficInfo.freeFlowSpeed * 3600; // seconds
      const actualTime = freeFlowTime / trafficInfo.currentSpeedFactor;
      totalDelay += actualTime - freeFlowTime;

      // Update congestion summary
      switch (trafficInfo.congestionLevel) {
        case 0: congestionSummary.free++; break;
        case 1: congestionSummary.light++; break;
        case 2: congestionSummary.moderate++; break;
        case 3: congestionSummary.heavy++; break;
      }
    }

    // Adjust total duration with traffic
    const baseDuration = this.estimateBaseDuration(routeCoords);
    const adjustedDuration = baseDuration + totalDelay;

    return {
      geometry: routeGeometry,
      duration: Math.round(adjustedDuration),
      distance: this.calculateTotalDistance(routeCoords),
      trafficSegments,
      totalDelay: Math.round(totalDelay),
      congestionSummary,
    };
  }

  private async estimateSegmentTraffic(
    p1: [number, number],
    p2: [number, number],
    hour: number,
    isWeekend: boolean
  ): Promise<TrafficInfo> {
    // Try to find matching traffic segment in DB
    const dbSegments = await this.trafficSegmentRepo
      .createQueryBuilder('ts')
      .where(`ST_DWithin(ts.coordinates, ST_MakeLine(ST_MakePoint(:lng1, :lat1), ST_MakePoint(:lng2, :lat2)), 0.001)`)
      .setParameters({ lng1: p1[0], lat1: p1[1], lng2: p2[0], lat2: p2[1] })
      .limit(1)
      .getMany();

    if (dbSegments.length > 0) {
      const seg = dbSegments[0];
      const profile = seg.congestionProfile?.hourlySpeedFactor || this.peakHourProfiles[seg.roadType] || this.peakHourProfiles.primary;
      let factor = profile[hour] || 1.0;
      if (isWeekend) factor *= this.weekendFactor;
      factor = Math.min(factor, 1.0);

      return {
        segmentId: seg.id,
        roadName: seg.roadName,
        roadType: seg.roadType,
        congestionLevel: seg.congestionLevel,
        currentSpeedFactor: factor,
        freeFlowSpeed: seg.freeFlowSpeed,
        estimatedSpeed: seg.freeFlowSpeed * factor,
      };
    }

    // Heuristic based on road type detection from coordinates
    // For now, use residential as default for unknown roads
    const roadType = this.detectRoadType(p1, p2);
    const freeFlowSpeed = this.defaultFreeFlowSpeeds[roadType] || 40;
    const profile = this.peakHourProfiles[roadType] || this.peakHourProfiles.primary;
    let factor = profile[hour] || 1.0;
    if (isWeekend) factor *= this.weekendFactor;
    factor = Math.min(factor, 1.0);

    // Determine congestion level from factor
    let congestionLevel = 0;
    if (factor < 0.5) congestionLevel = 3;
    else if (factor < 0.7) congestionLevel = 2;
    else if (factor < 0.9) congestionLevel = 1;

    return {
      segmentId: 'heuristic',
      roadName: 'Unknown',
      roadType,
      congestionLevel,
      currentSpeedFactor: factor,
      freeFlowSpeed,
      estimatedSpeed: freeFlowSpeed * factor,
    };
  }

  private detectRoadType(p1: number[], p2: number[]): string {
    // Simple heuristic: longer straight segments = higher road class
    const distance = this.haversineDistance(p1[1], p1[0], p2[1], p2[0]);
    if (distance > 500) return 'primary';
    if (distance > 200) return 'secondary';
    if (distance > 100) return 'tertiary';
    return 'residential';
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private estimateBaseDuration(routeCoords: number[][]): number {
    let total = 0;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const p1 = routeCoords[i];
      const p2 = routeCoords[i + 1];
      const dist = this.haversineDistance(p1[1], p1[0], p2[1], p2[0]);
      const roadType = this.detectRoadType(p1, p2);
      const speed = this.defaultFreeFlowSpeeds[roadType] || 40;
      total += (dist / 1000) / speed * 3600;
    }
    return total;
  }

  private calculateTotalDistance(routeCoords: number[][]): number {
    let total = 0;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const p1 = routeCoords[i];
      const p2 = routeCoords[i + 1];
      total += this.haversineDistance(p1[1], p1[0], p2[1], p2[0]);
    }
    return total;
  }

  private emptyRoute(): TrafficAwareRoute {
    return {
      geometry: null,
      duration: 0,
      distance: 0,
      trafficSegments: [],
      totalDelay: 0,
      congestionSummary: { free: 0, light: 0, moderate: 0, heavy: 0 },
    };
  }

  // Get congestion color for frontend
  getCongestionColor(level: number): string {
    switch (level) {
      case 0: return '#22c55e'; // green
      case 1: return '#eab308'; // yellow
      case 2: return '#f97316'; // orange
      case 3: return '#ef4444'; // red
      default: return '#6b7280';
    }
  }

  getCongestionLabel(level: number): string {
    switch (level) {
      case 0: return 'Thông thoáng';
      case 1: return 'Khá thoáng';
      case 2: return 'Độn áp';
      case 3: return 'Kẹt xe';
      default: return 'Không xác định';
    }
  }
}