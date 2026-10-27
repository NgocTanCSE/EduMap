import { Controller, Get, Post, Body, Query, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ImpactMeasurementService } from './impact-measurement.service';
import {
  FACILITY_TYPE_VALUES,
  FacilityType,
  ImpactMetricsQueryDto,
  MeasureImpactQueryDto,
} from './dto/impact-measurement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('19. AI Impact Measurement')
@Controller('impact-measurement')
export class ImpactMeasurementController {
  constructor(private readonly impactMeasurementService: ImpactMeasurementService) {}

  /**
   * GET /api/impact-measurement/metrics?minLat=...&maxLat=...&deploymentDate=...
   *
   * T1 — pure-backend before/after diff. Loads `map_points` from SQLite,
   * splits them into before/after cohorts by `created_at` vs. deployment_date,
   * and computes access_rate / usage_count / coverage_improvement.
   *
   * No AI dependency: always returns a valid diff (synthetic baseline when
   * before-data is missing). This is the source of truth for the before/after
   * chart series on the dashboard.
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Before/after diff metrics (T1) — access_rate, usage_count, coverage_improvement' })
  async getMetrics(@Query() params: ImpactMetricsQueryDto) {
    try {
      const data = await this.impactMeasurementService.computeMetrics(params);
      return { success: true, data };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to compute impact metrics: ${error?.message || error}`);
    }
  }

  /**
   * GET /api/impact-measurement/measure?minLat=...&maxLat=...&deploymentDate=...
   *
   * Full AI-enriched report: backend before/after diff (T1) → ai-service
   * trend analysis + confidence interval + impact score + LLM narrative (T2).
   * Caches the merged result for 24 h. On AI failure returns the backend diff
   * with a degraded flag + locally-computed score (never a 502).
   */
  @Get('measure')
  @ApiOperation({ summary: 'Full AI impact report — before/after diff + trend + impact score + CI (T1+T2)' })
  async getMeasure(@Query() params: MeasureImpactQueryDto) {
    try {
      // Query params are strings — convert to the numeric MeasureImpactDto.
      // (Passing the raw strings through made class-validator return 400.)
      const toNum = (v?: string) => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const rawTypes = params.facilityTypes;
      const facilityTypes = (Array.isArray(rawTypes) ? rawTypes : String(rawTypes ?? '').split(','))
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => (FACILITY_TYPE_VALUES as readonly string[]).includes(t)) as FacilityType[];

      const data = await this.impactMeasurementService.measure({
        minLat: toNum(params.minLat),
        maxLat: toNum(params.maxLat),
        minLng: toNum(params.minLng),
        maxLng: toNum(params.maxLng),
        lat: toNum(params.lat),
        lng: toNum(params.lng),
        radiusKm: toNum(params.radiusKm),
        deploymentDate: params.deploymentDate,
        region: params.region,
        facilityTypes: facilityTypes.length ? facilityTypes : undefined,
      });
      return { success: true, data };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to compute impact report: ${error?.message || error}`);
    }
  }
}
