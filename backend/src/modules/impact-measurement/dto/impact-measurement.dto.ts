import { IsEnum, IsIn, IsInt, IsISO8601, IsLatitude, IsLongitude, IsNumber, IsNumberString, IsOptional, IsString, Max, Min } from 'class-validator';

export const FACILITY_TYPE_VALUES = ['wifi', 'library', 'school', 'university', 'lab', 'green', 'cafe'] as const;

export type FacilityType = (typeof FACILITY_TYPE_VALUES)[number];

/**
 * Query params for GET /api/impact-measurement/metrics (T1 — before/after diff).
 *
 * Region is selected either by a bounding box (minLat/maxLat/minLng/maxLng)
 * or a center point + radius (lat/lng/radiusKm). All numeric filters are
 * optional strings (Next.js query params are strings).
 */
export class ImpactMetricsQueryDto {
  @IsOptional() @IsNumberString() minLat?: string;
  @IsOptional() @IsNumberString() maxLat?: string;
  @IsOptional() @IsNumberString() minLng?: string;
  @IsOptional() @IsNumberString() maxLng?: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) radiusKm?: number;
  @IsOptional() @IsString() deploymentDate?: string;
  @IsOptional() @IsString() region?: string;
}

/**
 * Body for GET/POST /api/impact-measurement/measure (full AI-enriched report).
 * Same region selector as the metrics query but as a typed body so the
 * frontend can POST a structured request.
 */
export class MeasureImpactDto {
  @IsOptional() @IsNumber() minLat?: number;
  @IsOptional() @IsNumber() maxLat?: number;
  @IsOptional() @IsNumber() minLng?: number;
  @IsOptional() @IsNumber() maxLng?: number;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) radiusKm?: number;
  @IsOptional() @IsString() deploymentDate?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() facilityTypes?: FacilityType[];
}

/**
 * Query-string variant of MeasureImpactDto for `GET /measure`.
 *
 * HTTP query params are ALWAYS strings, so `@IsNumber()` on a GET handler
 * makes class-validator reject every request with 400 Bad Request
 * (observed in production on HF). Validation therefore uses
 * `@IsNumberString()` and the controller converts to numbers afterwards.
 * `facilityTypes` arrives as a comma-separated list (or repeated params).
 */
export class MeasureImpactQueryDto {
  @IsOptional() @IsNumberString() minLat?: string;
  @IsOptional() @IsNumberString() maxLat?: string;
  @IsOptional() @IsNumberString() minLng?: string;
  @IsOptional() @IsNumberString() maxLng?: string;
  @IsOptional() @IsNumberString() lat?: string;
  @IsOptional() @IsNumberString() lng?: string;
  @IsOptional() @IsNumberString() radiusKm?: string;
  @IsOptional() @IsString() deploymentDate?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() facilityTypes?: string | string[];
}
