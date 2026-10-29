import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapPoint } from '../map/entities/map-point.entity';
import { Jimp, JimpMime } from 'jimp';
import {
  VisionDetectBodyDto,
  VisionDetectResult,
  Detection,
  DetectionBox,
} from './dto/vision-detect.dto';

// ---------- tile math helpers (pure functions) ----------

const TILE_SIZE = 256;

function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}

/** Convert lat/lng → XYZ tile at zoom Z (TMS-style y, i.e. y-from-top). */
function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const latRad = deg2rad(lat);
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/** Convert XYZ tile → geographic bounds (north, south, east, west). */
function tileToBounds(x: number, y: number, z: number): {
  north: number; south: number; east: number; west: number;
} {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { north, south, east, west };
}

/** Convert pixel (px, py) in the stitched image → lat/lng. */
function pixelToLatLng(
  px: number,
  py: number,
  startTileX: number,
  startTileY: number,
  z: number,
): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  const exactX = startTileX + px / TILE_SIZE;
  const exactY = startTileY + py / TILE_SIZE;
  const lng = (exactX / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * exactY) / n))) * 180) / Math.PI;
  return { lat, lng };
}

/** Tile URL templates per provider. */
function tileUrl(x: number, y: number, z: number, source: string, bingKey?: string): string {
  switch (source) {
    case 'bing': {
      // Convert XYZ → Bing quadkey
      let qk = '';
      for (let i = z; i > 0; i--) {
        let digit = 0;
        const mask = 1 << (i - 1);
        if ((x & mask) !== 0) digit += 1;
        if ((y & mask) !== 0) digit += 2;
        qk += String(digit);
      }
      const subdomain = ['a', 'b', 'c'][(x + y) % 3];
      if (bingKey) {
        return `https://t${subdomain}.ssl.ak.tiles.virtualearth.net/tiles/${qk}.png?token=${bingKey}`;
      }
      return `https://t${subdomain}.ssl.ak.tiles.virtualearth.net/tiles/${qk}.png`;
    }
    case 'esri': {
      // Esri World Imagery (aerial) — no key required, rate-limited
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }
    case 'osm':
    default: {
      // OSM standard tiles (no key needed) — shows buildings/labels
      const subdomain = ['a', 'b', 'c'][(x + y + z) % 3];
      return `https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    }
  }
}

// ---------- service ----------

const MAX_GRID = 8; // cap tile grid at 8×8 (64 tiles) to keep PNG < HF 5 MB limit

@Injectable()
export class GeoVisionService {
  private readonly logger = new Logger(GeoVisionService.name);
  private readonly aiServiceUrl: string;
  private readonly isSqlite: boolean;
  private readonly bingKey?: string;
  private readonly geoVisionModel: string;
  // In-memory LRU+TTL cache for stitched tiles (24h TTL) — matches the
  // project's existing cache pattern (MapService uses a Map<string, {data, expires}>).
  private readonly tileCache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly CACHE_MAX_ENTRIES = 64;

  constructor(
    @InjectRepository(MapPoint)
    private readonly mapPointRepo: Repository<MapPoint>,
    private readonly httpService: HttpService,
  ) {
    this.isSqlite = process.env.DB_TYPE === 'sqlite';
    this.aiServiceUrl =
      process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    this.bingKey = process.env.BING_MAPS_API_KEY || undefined;
    this.geoVisionModel = process.env.GEO_VISION_MODEL || 'google/owlv2-base-patch16-ensemble';
  }

  // ── T1: fetch + stitch tiles ──────────────────────────────────────────────

  /** Parse a bbox string "minLat,maxLat,minLng,maxLng" → object. */
  private parseBbox(bbox: string): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    const parts = bbox.split(',').map((p) => parseFloat(p.trim()));
    if (parts.length !== 4 || parts.some((v) => isNaN(v))) {
      throw new Error(`Invalid bbox: "${bbox}". Expected "minLat,maxLat,minLng,maxLng".`);
    }
    return { minLat: parts[0], maxLat: parts[1], minLng: parts[2], maxLng: parts[3] };
  }

  /**
   * Fetch satellite/map tiles for the given bbox at the given zoom and stitch
   * them into a single PNG.
   * Returns { image_base64 (PNG, no data-uri prefix), width, height, tile_coords, tile_count, source }.
   */
  async fetchAndStitchTiles(
    bboxStr: string,
    zoom: number = 18,
    source: string = 'osm',
  ): Promise<{
    image_base64: string;
    width: number;
    height: number;
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    zoom: number;
    tile_count: number;
    tile_coords: Array<{ x: number; y: number; z: number }>;
    source: string;
  }> {
    const cacheKey = `geovision:tiles:${bboxStr}:${zoom}:${source}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      this.logger.debug(`Tile cache HIT: ${cacheKey}`);
      return cached.data;
    }

    const bounds = this.parseBbox(bboxStr);
    const z = Math.min(zoom, 20);

    // Determine tile range
    const tl = latLngToTile(bounds.maxLat, bounds.minLng, z); // top-left
    const br = latLngToTile(bounds.minLat, bounds.maxLng, z); // bottom-right

    let tileXs: number[] = [];
    let tileYs: number[];
    for (let x = tl.x; x <= br.x; x++) tileXs.push(x);
    for (let y = tl.y; y <= br.y; y++) tileYs.push(y);

    // Cap grid to MAX_GRID × MAX_GRID
    if (tileXs.length > MAX_GRID) {
      tileXs = tileXs.slice(0, MAX_GRID);
      this.logger.warn(`Tile X range exceeded ${MAX_GRID}, truncated.`);
    }
    if (tileYs.length > MAX_GRID) {
      tileYs = tileYs.slice(0, MAX_GRID);
      this.logger.warn(`Tile Y range exceeded ${MAX_GRID}, truncated.`);
    }

    const cols = tileXs.length;
    const rows = tileYs.length;
    const width = cols * TILE_SIZE;
    const height = rows * TILE_SIZE;
    const tileCoords: Array<{ x: number; y: number; z: number }> = [];

    // Fetch tiles concurrently (with per-request timeout)
    const fetches: Promise<{ x: number; y: number; buf: Buffer } | null>[] = [];
    for (const y of tileYs) {
      for (const x of tileXs) {
        tileCoords.push({ x, y, z });
        fetches.push(this.fetchTile(x, y, z, source));
      }
    }
    const results = await Promise.all(fetches);

    // Stitch with jimp
    const canvas = new Jimp({ width, height, color: 0x000000FF });
    let fetchedCount = 0;
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (!res) continue;
      const { x, y, buf } = res;
      const col = x - tileXs[0];
      const row = y - tileYs[0];
      try {
        const tileImg = await Jimp.fromBuffer(buf);
        canvas.composite(tileImg, col * TILE_SIZE, row * TILE_SIZE);
        fetchedCount++;
      } catch (e) {
        this.logger.warn(`Failed to composite tile ${x}/${y}/${z}: ${(e as Error).message}`);
      }
    }

    if (fetchedCount === 0) {
      throw new Error(`No tiles could be fetched for bbox ${bboxStr} at zoom ${z}.`);
    }

    // Convert to base64 PNG
    const pngBuffer = await canvas.getBuffer(JimpMime.png);
    const imageBase64 = pngBuffer.toString('base64');

    const result = {
      image_base64: imageBase64,
      width,
      height,
      bbox: bounds,
      zoom: z,
      tile_count: fetchedCount,
      tile_coords: tileCoords,
      source,
    };

    // Cache for 24 h (HF Inference quota management)
    if (this.tileCache.size >= this.CACHE_MAX_ENTRIES) {
      // Evict oldest entry (FIFO by insertion order)
      const oldestKey = this.tileCache.keys().next().value;
      this.tileCache.delete(oldestKey);
    }
    this.tileCache.set(cacheKey, { data: result, expires: Date.now() + this.CACHE_TTL_MS });
    return result;
  }

  /** Fetch a single tile, returns null on failure. */
  private async fetchTile(
    x: number,
    y: number,
    z: number,
    source: string,
  ): Promise<{ x: number; y: number; buf: Buffer } | null> {
    const url = tileUrl(x, y, z, source, this.bingKey);
    try {
      const res = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'arraybuffer',
          timeout: 8000,
          headers: { 'User-Agent': 'EduMap-GeoVision/1.0' },
        }),
      );
      const buf = Buffer.from(res.data);
      if (buf.length < 100) return null;
      return { x, y, buf };
    } catch (e) {
      this.logger.warn(`Tile fetch failed ${url}: ${(e as Error).message}`);
      return null;
    }
  }

  // ── T2 (backend side): send to AI service ─────────────────────────────────

  /**
   * POST to the AI service's /api/ai/geo/vision-detect endpoint.
   * The AI service calls the HF Inference API (google/owlv2) via curl.
   */
  async sendToVisionModel(
    imageBase64: string,
    labels?: string[],
  ): Promise<{
    detections: Array<{ score: number; label: string; box: DetectionBox }>;
    model: string;
    degraded: boolean;
    error?: string;
  }> {
    const payload: { image_base64: string; labels?: string[] } = { image_base64: imageBase64 };
    if (labels && labels.length > 0) payload.labels = labels;

    try {
      const res = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/api/ai/geo/vision-detect`, payload, {
          timeout: 25000,
        }),
      );
      const body = res.data;
      return {
        detections: body.detections || [],
        model: body.model || this.geoVisionModel,
        degraded: body.degraded || false,
        error: body.error,
      };
    } catch (e: any) {
      this.logger.warn(`AI service vision-detect call failed: ${e.message}`);
      return {
        detections: [],
        model: this.geoVisionModel,
        degraded: true,
        error: e.message,
      };
    }
  }

  // ── T3: cross-check detections with map_points ────────────────────────────

  /** Query existing map_points within the bbox via raw SQL. */
  async getExistingPointsInBounds(
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  ): Promise<Array<{ id: string; name: string; type: string; lat: number; lng: number }>> {
    if (this.isSqlite) {
      // SQLite: location stored as GeoJSON JSON string or EWKT.
      // We query with raw SQL, fetching all and filtering in TS because
      // SQLite has no ST_Intersects. The LIMIT 5000 keeps this bounded.
      const raw = await this.mapPointRepo.query(
        `SELECT id, name, type_id, location, address FROM map_points WHERE deleted_at IS NULL LIMIT 5000`,
      );
      const results: Array<{ id: string; name: string; type: string; lat: number; lng: number }> = [];
      const typesMap: { [k: number]: string } = {
        1: 'university', 2: 'school', 3: 'library', 4: 'bookstore',
        5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe',
        9: 'restaurant', 10: 'market', 11: 'convenience',
      };
      for (const r of raw as any[]) {
        const coords = this.parseCoords(r.location);
        if (!coords) continue;
        const [lng, lat] = coords;
        if (
          lat >= bounds.minLat &&
          lat <= bounds.maxLat &&
          lng >= bounds.minLng &&
          lng <= bounds.maxLng
        ) {
          results.push({
            id: r.id,
            name: r.name,
            type: typesMap[r.type_id] || 'other',
            lat,
            lng,
          });
        }
      }
      return results;
    } else {
      // PostgreSQL: use ST_Intersects
      const raw = await this.mapPointRepo.query(
        `SELECT id, name, type_id, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
         FROM map_points
         WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
         AND deleted_at IS NULL
         LIMIT 5000`,
        [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat],
      );
      const typesMap: { [k: number]: string } = {
        1: 'university', 2: 'school', 3: 'library', 4: 'bookstore',
        5: 'lab', 6: 'wifi', 7: 'green', 8: 'cafe',
        9: 'restaurant', 10: 'market', 11: 'convenience',
      };
      return (raw as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        type: typesMap[r.type_id] || 'other',
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
      }));
    }
  }

  /** Parse location from various formats (GeoJSON, EWKT, JSON string, array). */
  private parseCoords(value: any): [number, number] | null {
    if (!value) return null;
    if (typeof value === 'object') {
      if (Array.isArray(value) && value.length >= 2) return [Number(value[0]), Number(value[1])];
      if (value.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
        return [Number(value.coordinates[0]), Number(value.coordinates[1])];
      }
      if (Array.isArray((value as any).coordinates) && (value as any).coordinates.length >= 2) {
        return [Number((value as any).coordinates[0]), Number((value as any).coordinates[1])];
      }
      if (typeof value.lat === 'number' && typeof value.lng === 'number') return [value.lng, value.lat];
    }
    if (typeof value === 'string') {
      const ewktMatch = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (ewktMatch) return [Number(ewktMatch[1]), Number(ewktMatch[2])];
      try {
        return this.parseCoords(JSON.parse(value));
      } catch { /* fall through */ }
    }
    return null;
  }

  /** Haversine distance in metres between two lat/lng points. */
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R);
  }

  /**
   * Given detection boxes (pixel coords in stitched image) and the tile grid,
   * convert each box to geographic coordinates and check proximity to existing
   * map_points. Returns detections annotated with lat/lng + match status.
   */
  annotateDetections(
    detections: Array<{ score: number; label: string; box: DetectionBox }>,
    tileCoords: Array<{ x: number; y: number; z: number }>,
    startTileX: number,
    startTileY: number,
    z: number,
    existingPoints: Array<{ id: string; name: string; type: string; lat: number; lng: number }>,
    matchThresholdM: number = 80,
  ): Detection[] {
    const annotated: Detection[] = detections.map((d) => {
      // Use box center point for geolocation
      const centerPx = (d.box.xmin + d.box.xmax) / 2;
      const centerPy = (d.box.ymin + d.box.ymax) / 2;
      const { lat, lng } = pixelToLatLng(centerPx, centerPy, startTileX, startTileY, z);

      // Find nearest existing point
      let nearest: { id: string; name: string; type: string; lat: number; lng: number; distance_m: number } | null = null;
      let minDist = Infinity;
      for (const p of existingPoints) {
        const dist = this.haversine(lat, lng, p.lat, p.lng);
        if (dist < minDist && dist < matchThresholdM) {
          minDist = dist;
          nearest = { ...p, distance_m: dist };
        }
      }

      return {
        score: d.score,
        label: d.label,
        box: d.box,
        lat,
        lng,
        match: nearest ? 'known' : 'new',
        nearest_poi: nearest,
      };
    });
    return annotated;
  }

  // ── Orchestrator: T1 + T2 + T3 ─────────────────────────────────────────────

  /**
   * POST /api/geo/vision-detect — orchestrates the full pipeline:
   * 1. Fetch + stitch satellite tiles (T1)
   * 2. Send to AI service → HF Inference API owlV2 (T2)
   * 3. Cross-check with existing map_points (T3)
   */
  async runVisionDetect(dto: VisionDetectBodyDto): Promise<VisionDetectResult> {
    // T1 — fetch + stitch tiles
    const tileData = await this.fetchAndStitchTiles(dto.bbox, dto.zoom ?? 18, dto.source ?? 'osm');

    // Extract grid info for pixel→lat/lng conversion
    const startTileX = Math.min(...tileData.tile_coords.map((t) => t.x));
    const startTileY = Math.min(...tileData.tile_coords.map((t) => t.y));
    const z = tileData.zoom;
    const bounds = tileData.bbox;

    // T2 — send to AI service
    const aiResult = await this.sendToVisionModel(tileData.image_base64, dto.labels);

    // T3 — cross-check with existing map_points
    const existingPoints = await this.getExistingPointsInBounds(bounds);
    const annotatedDetections = this.annotateDetections(
      aiResult.detections,
      tileData.tile_coords,
      startTileX,
      startTileY,
      z,
      existingPoints,
    );

    const known = annotatedDetections.filter((d) => d.match === 'known');
    const new_ = annotatedDetections.filter((d) => d.match === 'new');

    return {
      detections: annotatedDetections,
      known,
      new: new_,
      bbox: bounds,
      zoom: z,
      stitched_metadata: {
        width: tileData.width,
        height: tileData.height,
        tile_count: tileData.tile_count,
        tile_coords: tileData.tile_coords,
        source: tileData.source,
      },
      degraded: aiResult.degraded,
      error: aiResult.error,
    };
  }
}
