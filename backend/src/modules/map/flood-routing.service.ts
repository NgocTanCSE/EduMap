import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FloodZone } from './entities/flood-zone.entity';

export interface FloodZoneInfo {
  id: string;
  name: string;
  riskLevel: string;
  coordinates: any;
  metadata?: any;
}

export interface RouteWithFloodCheck {
  geometry: any;
  duration: number;
  distance: number;
  floodWarnings: FloodZoneInfo[];
  avoidedFloodZones: FloodZoneInfo[];
}

@Injectable()
export class FloodRoutingService {
  private readonly logger = new Logger(FloodRoutingService.name);

  constructor(
    @InjectRepository(FloodZone)
    private readonly floodZoneRepo: Repository<FloodZone>,
  ) {}

  async getActiveFloodZones(date?: Date): Promise<FloodZone[]> {
    const checkDate = date || new Date();
    const month = checkDate.getMonth() + 1; // 1-12

    try {
      const query = this.floodZoneRepo.createQueryBuilder('fz');

      // Filter by flood months if specified in metadata
      query.where(
        `(fz.metadata->>'floodMonths' IS NULL OR fz.metadata->>'floodMonths' = '' OR fz.metadata->'floodMonths' @> :month)`,
        { month: JSON.stringify([month]) }
      );

      // Or include seasonal/always active zones
      query.orWhere(`fz.riskLevel IN (:...levels)`, { levels: ['seasonal', 'high'] });

      return await query.getMany();
    } catch (error: any) {
      this.logger.warn(`FloodZone DB query failed (table may not exist in this environment): ${error.message}`);
      // Graceful fallback: treat as no known flood zones so routing still
      // works without the table. The flood-analysis still runs on whatever
      // data is available; missing data just means no warnings.
      return [];
    }
  }

  async checkRouteForFloods(routeGeometry: any, date?: Date): Promise<{
    intersects: boolean;
    floodZones: FloodZoneInfo[];
    affectedSegments: number;
  }> {
    if (!routeGeometry || routeGeometry.type !== 'LineString') {
      return { intersects: false, floodZones: [], affectedSegments: 0 };
    }

    const activeZones = await this.getActiveFloodZones(date);
    const routeCoords = routeGeometry.coordinates;
    const floodZones: FloodZoneInfo[] = [];
    let affectedSegments = 0;

    for (const zone of activeZones) {
      // zone.coordinates is a GeoJSON geometry ({type:'Polygon', coordinates:[ring,...]})
      // but lineIntersectsPolygon expects a bare number[][] ring. Without this
      // extraction the GeoJSON object has no .length → intersection is never
      // detected and ALL flood checks silently return false.
      const polygonRing: number[][] = this.extractPolygonRing(zone.coordinates);

      if (polygonRing.length > 0 && this.lineIntersectsPolygon(routeCoords, polygonRing)) {
        floodZones.push({
          id: zone.id,
          name: zone.name,
          riskLevel: zone.riskLevel,
          coordinates: zone.coordinates,
          metadata: zone.metadata,
        });

        // Count affected segments
        for (let i = 0; i < routeCoords.length - 1; i++) {
          if (this.segmentIntersectsPolygon(routeCoords[i], routeCoords[i + 1], polygonRing)) {
            affectedSegments++;
          }
        }
      }
    }

    return {
      intersects: floodZones.length > 0,
      floodZones,
      affectedSegments,
    };
  }

  /** Extract the outer ring [number[][]] from a GeoJSON Polygon/MultiPolygon
   * or pass-through if already a bare coordinate array. */
  private extractPolygonRing(coords: any): number[][] {
    if (!coords) return [];
    if (Array.isArray(coords)) return coords as number[][];
    // GeoJSON geometry: { type: 'Polygon', coordinates: [ring, ...] }
    if (coords.type === 'Polygon' && Array.isArray(coords.coordinates) && coords.coordinates[0]) {
      return coords.coordinates[0] as number[][];
    }
    // GeoJSON MultiPolygon: { type: 'MultiPolygon', coordinates: [[ring,...],...] }
    if (coords.type === 'MultiPolygon' && Array.isArray(coords.coordinates) && coords.coordinates[0] && coords.coordinates[0][0]) {
      return coords.coordinates[0][0] as number[][];
    }
    return [];
  }

  async getFloodAvoidancePolygons(date?: Date): Promise<any[]> {
    const activeZones = await this.getActiveFloodZones(date);
    return activeZones.map(zone => zone.coordinates);
  }

  // Ray casting algorithm for point in polygon
  private pointInPolygon(point: [number, number], polygon: number[][]): boolean {
    const [lng, lat] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [lngI, latI] = polygon[i];
      const [lngJ, latJ] = polygon[j];

      if (((latI > lat) !== (latJ > lat)) &&
          (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI)) {
        inside = !inside;
      }
    }

    return inside;
  }

  // Check if line segment intersects polygon
  private segmentIntersectsPolygon(p1: number[], p2: number[], polygon: number[][]): boolean {
    // Check if either endpoint is inside
    if (this.pointInPolygon([p1[0], p1[1]], polygon) || this.pointInPolygon([p2[0], p2[1]], polygon)) {
      return true;
    }

    // Check if segment intersects any polygon edge
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const p3 = polygon[i] as [number, number];
      const p4 = polygon[j] as [number, number];
      if (this.segmentsIntersect([p1[0], p1[1]], [p2[0], p2[1]], p3, p4)) {
        return true;
      }
    }

    return false;
  }

  // Check if entire line intersects polygon
  private lineIntersectsPolygon(lineCoords: number[][], polygon: number[][]): boolean {
    for (let i = 0; i < lineCoords.length - 1; i++) {
      if (this.segmentIntersectsPolygon(lineCoords[i], lineCoords[i + 1], polygon)) {
        return true;
      }
    }
    return false;
  }

  // Line segment intersection
  private segmentsIntersect(
    p1: [number, number], p2: [number, number],
    p3: [number, number], p4: [number, number]
  ): boolean {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;
    const [x4, y4] = p4;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return false; // Parallel

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // Generate avoid polygons for OSRM (simplified bounding boxes)
  generateAvoidPolygons(floodZones: FloodZoneInfo[], bufferMeters: number = 100): any[] {
    return floodZones.map(zone => {
      const coords = zone.coordinates.coordinates[0]; // First ring of polygon
      // Add small buffer by expanding bbox
      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      const minLng = Math.min(...lngs) - bufferMeters / 111000;
      const maxLng = Math.max(...lngs) + bufferMeters / 111000;
      const minLat = Math.min(...lats) - bufferMeters / 111000;
      const maxLat = Math.max(...lats) + bufferMeters / 111000;

      return {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      };
    });
  }
}