import { IsString, IsNumber, IsOptional, IsInt, Min, Max, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class SatelliteTilesQueryDto {
  // bbox="minLat,maxLat,minLng,maxLng"  (comma-separated, WGS-84 degrees)
  @IsString()
  bbox: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Transform(({ value }) => (value === undefined ? 18 : Number(value)))
  zoom?: number = 18;

  @IsOptional()
  @IsString()
  source?: string = 'osm'; // 'osm' | 'bing' | 'esri'
}

export class VisionDetectBodyDto {
  @IsString()
  bbox: string; // "minLat,maxLat,minLng,maxLng"

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  zoom?: number = 18;

  @IsOptional()
  @IsString()
  source?: string = 'osm';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}

export interface DetectionBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface Detection {
  score: number;
  label: string;
  box: DetectionBox;
  lat?: number;
  lng?: number;
  match?: 'known' | 'new';
  nearest_poi?: {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    distance_m: number;
  } | null;
}

export interface VisionDetectResult {
  detections: Detection[];
  known: Detection[];
  new: Detection[];
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  zoom: number;
  stitched_metadata: {
    width: number;
    height: number;
    tile_count: number;
    tile_coords: Array<{ x: number; y: number; z: number }>;
    source: string;
  };
  degraded: boolean;
  error?: string;
}
