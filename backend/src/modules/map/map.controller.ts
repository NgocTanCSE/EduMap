import { Controller, Get, Post, Param, Query, Body, InternalServerErrorException, BadRequestException, NotFoundException, ValidationPipe, UseGuards } from '@nestjs/common';

import { SkipThrottle } from '@nestjs/throttler';

import { MapService } from './map.service';
import { RoutingService, SafeRoutePreferences } from './routing.service';

import { AiAnalysisDto } from './dto/ai-analysis.dto';

import { CreateMapPointDto } from './dto/create-map-point.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';



@Controller('map')

export class MapController {

  constructor(
    private readonly mapService: MapService,
    private readonly routingService: RoutingService,
  ) {}


  /**
   * SafeRoute AI (Idea #12) — GET /api/map/safe-route
   * Weighted multi-criteria routing: returns multiple route alternatives
   * each with a safety score (distance, duration, flood risk, traffic).
   */
  @Get('safe-route')
  @SkipThrottle()
  async getSafeRoute(
    @Query('lng1') lng1: string,
    @Query('lat1') lat1: string,
    @Query('lng2') lng2: string,
    @Query('lat2') lat2: string,
    @Query('avoidFlood') avoidFlood = 'true',
    @Query('avoidTraffic') avoidTraffic = 'true',
    @Query('safetyWeight') safetyWeight?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
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

      const preferences: SafeRoutePreferences = {
        avoidFlood: avoidFlood !== 'false',
        avoidTraffic: avoidTraffic !== 'false',
        safetyWeight: safetyWeight ? parseFloat(safetyWeight) : 0.3,
        maxDistanceKm: maxDistanceKm ? parseFloat(maxDistanceKm) : undefined,
      };

      const result = await this.routingService.safeRoute(
        [coords.lng1, coords.lat1],
        [coords.lng2, coords.lat2],
        preferences,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`SafeRoute failed: ${error.message}`);
    }
  }

  @Get('pois')

  @SkipThrottle()

  async getAllPois(

    @Query('category') category?: string,

    @Query('minLat') minLat?: string,

    @Query('maxLat') maxLat?: string,

    @Query('minLng') minLng?: string,

    @Query('maxLng') maxLng?: string

  ) {

    try {

      let bounds = undefined;

      if (minLat && maxLat && minLng && maxLng) {

        bounds = {

          minLat: parseFloat(minLat),

          maxLat: parseFloat(maxLat),

          minLng: parseFloat(minLng),

          maxLng: parseFloat(maxLng)

        };

      }

      if (category) {

        const filteredPois = await this.mapService.findPoisByCategory(category, bounds);

        return { success: true, data: filteredPois };

      }

      const allPois = await this.mapService.findAllPois(bounds);

      return { success: true, data: allPois };

    } catch (error: any) {

      console.error(`Error getting points of interest: ${error.message}`);

      throw new InternalServerErrorException('Failed to retrieve points of interest');

    }

  }



  @Get('locations')

  @SkipThrottle()

  async getLocations(

    @Query('minLat') minLat?: string,

    @Query('maxLat') maxLat?: string,

    @Query('minLng') minLng?: string,

    @Query('maxLng') maxLng?: string

  ) {

    try {

      let bounds = undefined;

      if (minLat && maxLat && minLng && maxLng) {

        bounds = {

          minLat: parseFloat(minLat),

          maxLat: parseFloat(maxLat),

          minLng: parseFloat(minLng),

          maxLng: parseFloat(maxLng)

        };

      }

      const allPois = await this.mapService.findAllPois(bounds);

      return { success: true, data: allPois };

    } catch (error: any) {

      console.error(`Error getting locations: ${error.message}`);

      throw new InternalServerErrorException('Failed to retrieve locations');

    }

  }



  @Get('categories')

  @SkipThrottle()

  async getCategories() {

    try {

      const categories = await this.mapService.getCategories();

      return { success: true, data: categories };

    } catch (error: any) {

      console.error(`Error getting categories: ${error.message}`);

      throw new InternalServerErrorException('Failed to retrieve categories');

    }

  }



  @Post('pois')

  @UseGuards(JwtAuthGuard)

  async createPoi(@Body(new ValidationPipe({ whitelist: true })) body: CreateMapPointDto) {

    try {

      const result = await this.mapService.createPoi(body);

      return { success: true, data: result };

    } catch (error: any) {

      console.error(`Error creating point of interest: ${error.message}`);

      throw new InternalServerErrorException('Failed to create point of interest');

    }

  }



  @Post('ai-analysis')

  @UseGuards(JwtAuthGuard)

  async aiAnalysis(@Body(new ValidationPipe({ whitelist: true })) body: AiAnalysisDto) {

    if (!body || !body.query) {

      throw new BadRequestException('Query string is required for AI analysis');

    }

    

    try {

      const result = await this.mapService.analyzeWithAI(body.query, body.context);

      return { success: true, data: result };

    } catch (error: any) {

      console.error(`Error during AI map analysis: ${error.message}`);

      throw new InternalServerErrorException('An error occurred while processing the AI request');

    }

  }



  @Get('stats')

  @SkipThrottle()

  async getStats() {

    try {

      const stats = await this.mapService.getStats();

      return { success: true, data: stats };

    } catch (error: any) {

      console.error(`Error getting map stats: ${error.message}`);

      throw new InternalServerErrorException('Failed to retrieve map stats');

    }

  }


  @Get('gap-forecast')
  @SkipThrottle()
  async getGapForecast(
    @Query('region') region?: string,
    @Query('steps') steps?: string,
  ) {
    try {
      const stepsAhead = steps ? Math.max(1, Math.min(10, parseInt(steps, 10))) : 3;
      const result = await this.mapService.getGapForecast(region, stepsAhead);
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting gap forecast: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve gap forecast');
    }
  }

  /**
   * GET /api/map/climate-risk — Idea #11: AI Climate Learning Guardian.
   *
   * Returns a flood/weather risk heatmap GeoJSON for a bounding box
   * (or a center point + radius). The heavy computation runs in the
   * ai-service (POST /api/ai/climate/risk); results are cached on both
   * sides (24 h ai-service + 24 h backend).
   */
  @Get('climate-risk')
  @SkipThrottle()
  async getClimateRisk(
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('date') date?: string,
  ) {
    try {
      const result = await this.mapService.getClimateRisk({
        minLat: minLat ? parseFloat(minLat) : undefined,
        maxLat: maxLat ? parseFloat(maxLat) : undefined,
        minLng: minLng ? parseFloat(minLng) : undefined,
        maxLng: maxLng ? parseFloat(maxLng) : undefined,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm) : 15,
        date: date || undefined,
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting climate risk: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve climate risk heatmap');
    }
  }

  /**
   * POST /api/map/climate/alternatives — Idea #11: AI Climate Learning Guardian.
   *
   * Recommends safe alternative learning locations (schools, universities,
   * libraries, wifi hotspots) near a point, outside high-risk flood zones.
   */
  @Post('climate/alternatives')
  @SkipThrottle()
  async postClimateAlternatives(
    @Body() body: {
      lat?: number;
      lng?: number;
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
      radiusKm?: number;
      category?: string;
    },
  ) {
    try {
      const bodyLat = body.lat ?? 10.9525;  // default: DNTU
      const bodyLng = body.lng ?? 106.8778;
      const result = await this.mapService.getClimateAlternatives({
        lat: bodyLat,
        lng: bodyLng,
        minLat: body.minLat,
        maxLat: body.maxLat,
        minLng: body.minLng,
        maxLng: body.maxLng,
        radiusKm: body.radiusKm ?? 10,
        category: body.category,
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting climate alternatives: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve climate alternatives');
    }
  }


  /**
   * GET /api/map/data-gaps — Idea #6: Missing Data Hunter.
   *
   * Grid-based coverage analysis + attribute gap detection. Accepts query
   * params (grid_size_km, top_n, min_lat, max_lat, min_lng, max_lng,
   * categories) and returns a cached (TTL 3600 s) GeoJSON FeatureCollection
   * of gap grid-cells + attribute gap summary. The heavy computation runs in
   * the ai-service; this backend fetches POIs, POSTs them, and caches.
   */
  @Get('data-gaps')
  @SkipThrottle()
  async getDataGaps(
    @Query('grid_size_km') gridSizeKm?: string,
    @Query('top_n') topN?: string,
    @Query('min_lat') minLat?: string,
    @Query('max_lat') maxLat?: string,
    @Query('min_lng') minLng?: string,
    @Query('max_lng') maxLng?: string,
    @Query('categories') categories?: string,
  ) {
    try {
      const gridSize = gridSizeKm ? parseFloat(gridSizeKm) : 1.0;
      const n = topN ? Math.max(1, Math.min(500, parseInt(topN, 10))) : 50;
      const cats = categories ? categories.split(',').filter(Boolean) : undefined;
      const bounds = (minLat && maxLat && minLng && maxLng)
        ? {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng),
          }
        : undefined;
      const result = await this.mapService.getDataGaps({ grid_size_km: gridSize, top_n: n, bounds, categories: cats });
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting data gaps: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve data gaps');
    }
  }
  @SkipThrottle()
  async getFixedLocations() {
    try {
      const fixed = await this.mapService.getFixedLocations();
      return { success: true, data: fixed };
    } catch (error: any) {
      console.error(`Error getting fixed locations: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve fixed locations');
    }
  }

  @Get('featured-pins')
  @SkipThrottle()
  async getFeaturedPins(
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string
  ) {
    try {
      let bounds = undefined;
      if (minLat && maxLat && minLng && maxLng) {
        bounds = {
          minLat: parseFloat(minLat),
          maxLat: parseFloat(maxLat),
          minLng: parseFloat(minLng),
          maxLng: parseFloat(maxLng),
        };
      }
      const pins = await this.mapService.getFeaturedPins(bounds);
      return { success: true, data: pins };
    } catch (error: any) {
      console.error(`Error getting featured pins: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve featured pins');
    }
  }


  @Get('poi/:id')
  @SkipThrottle()
  async getPoiDetails(@Param('id') id: string) {
    try {
      const result = await this.mapService.getPoiDetails(id);
      if (!result.poi) {
        throw new NotFoundException('Point of interest not found');
      }
      return { success: true, data: result };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      console.error(`Error getting POI details: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve point of interest');
    }
  }

  /**
   * GET /api/map/resource-optimization
   * Idea #1: AI Education Resource Optimizer (MCLP).
   *
   * Accepts query params (budget, coverage_radius_km, center_lat, center_lng,
   * region_radius_km) and returns a cached (TTL 3600 s) GeoJSON
   * FeatureCollection of A/B/C facility-placement plans + gap areas.
   * The heavy lifting (scipy MCLP) is delegated to the ai-service via
   * MapService.getResourceOptimization().
   */
  @Get('resource-optimization')
  @SkipThrottle()
  async getResourceOptimization(
    @Query('budget') budget?: string,
    @Query('coverage_radius_km') coverageRadiusKm?: string,
    @Query('center_lat') centerLat?: string,
    @Query('center_lng') centerLng?: string,
    @Query('region_radius_km') regionRadiusKm?: string,
  ) {
    try {
      const params = {
        budget: budget ? parseFloat(budget) : undefined,
        coverage_radius_km: coverageRadiusKm ? parseFloat(coverageRadiusKm) : undefined,
        center_lat: centerLat ? parseFloat(centerLat) : undefined,
        center_lng: centerLng ? parseFloat(centerLng) : undefined,
        region_radius_km: regionRadiusKm ? parseFloat(regionRadiusKm) : undefined,
      };
      const result = await this.mapService.getResourceOptimization(params);
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error during resource optimization: ${error.message}`);
      throw new InternalServerErrorException('Failed to optimize resource allocation');
    }
  }

  /**
   * GET /api/map/nl-search?q=<vietnamese query>
   *
   * Talk2Map (Idea #4): Tìm kiếm bản đồ bằng câu hỏi tiếng Việt.
   *
   * Flow:
   *   1. Backend → ai-service POST /api/ai/map/query (parse Vietnamese NL)
   *   2. Backend → SQLite findAllPois/findPoisByCategory (filter by parsed criteria)
   *   3. Return structured results to frontend BFF.
   *
   * Public endpoint (no auth required) — thích giống với /api/map/pois.
   */
  @Get('nl-search')
  @SkipThrottle()
  async nLSearch(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || !query.trim()) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    try {
      const result = await this.mapService.nLSearch(
        query,
        limit ? parseInt(limit, 10) : 20
      );
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error during NL search: ${error.message}`);
      throw new InternalServerErrorException('An error occurred while processing the search request');
    }
  }

  /**
   * GET /api/map/survey/priorities — Idea #20: AI Active Learning Survey.
   *
   * Returns an ordered list of survey candidate cells (GeoJSON
   * FeatureCollection + ``next_point``) ranked by ``info_value / cost``.
   * The ranking is computed by the ai-service (POST /api/ai/survey/priorities)
   * from live POIs fetched by ``MapService.getSurveyPriorities`` — NO LLM is
   * involved, so the response is fast and bounded. Cached 3600 s.
   *
   * Query params: current_lat, current_lng, min_lat, max_lat, min_lng, max_lng,
   * grid_size_km, top_n, survey_time_hours, surveyor_speed_kmh,
   * influence_radius_km, spatial_weight.
   *
   * Public (no auth) — mirrors /api/map/gap-forecast / data-gaps so the
   * survey planner renders for anonymous visitors.
   */
  @Get('survey/priorities')
  @SkipThrottle()
  async getSurveyPriorities(
    @Query('current_lat') currentLat?: string,
    @Query('current_lng') currentLng?: string,
    @Query('min_lat') minLat?: string,
    @Query('max_lat') maxLat?: string,
    @Query('min_lng') minLng?: string,
    @Query('max_lng') maxLng?: string,
    @Query('grid_size_km') gridSizeKm?: string,
    @Query('top_n') topN?: string,
    @Query('survey_time_hours') surveyTimeHours?: string,
    @Query('surveyor_speed_kmh') surveyorSpeedKmh?: string,
    @Query('influence_radius_km') influenceRadiusKm?: string,
    @Query('spatial_weight') spatialWeight?: string,
  ) {
    try {
      const result = await this.mapService.getSurveyPriorities({
        current_lat: currentLat ? parseFloat(currentLat) : undefined,
        current_lng: currentLng ? parseFloat(currentLng) : undefined,
        min_lat: minLat ? parseFloat(minLat) : undefined,
        max_lat: maxLat ? parseFloat(maxLat) : undefined,
        min_lng: minLng ? parseFloat(minLng) : undefined,
        max_lng: maxLng ? parseFloat(maxLng) : undefined,
        grid_size_km: gridSizeKm ? parseFloat(gridSizeKm) : undefined,
        top_n: topN ? parseInt(topN, 10) : undefined,
        survey_time_hours: surveyTimeHours ? parseFloat(surveyTimeHours) : undefined,
        surveyor_speed_kmh: surveyorSpeedKmh ? parseFloat(surveyorSpeedKmh) : undefined,
        influence_radius_km: influenceRadiusKm ? parseFloat(influenceRadiusKm) : undefined,
        spatial_weight: spatialWeight !== undefined ? parseFloat(spatialWeight) : undefined,
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting survey priorities: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve survey priorities');
    }
  }

  /**
   * GET /api/map/survey/next — Idea #20: AI Active Learning Survey.
   *
   * Returns the single best next survey point (top-1 of the priority ranking).
   * Cached 3600 s; degrades to a valid empty result on failure.
   *
   * Public (no auth) — mirrors the other map analysis endpoints.
   */
  @Get('survey/next')
  @SkipThrottle()
  async getSurveyNext(
    @Query('current_lat') currentLat?: string,
    @Query('current_lng') currentLng?: string,
    @Query('min_lat') minLat?: string,
    @Query('max_lat') maxLat?: string,
    @Query('min_lng') minLng?: string,
    @Query('max_lng') maxLng?: string,
    @Query('grid_size_km') gridSizeKm?: string,
    @Query('top_n') topN?: string,
    @Query('survey_time_hours') surveyTimeHours?: string,
    @Query('surveyor_speed_kmh') surveyorSpeedKmh?: string,
    @Query('influence_radius_km') influenceRadiusKm?: string,
    @Query('spatial_weight') spatialWeight?: string,
  ) {
    try {
      const result = await this.mapService.getSurveyNext({
        current_lat: currentLat ? parseFloat(currentLat) : undefined,
        current_lng: currentLng ? parseFloat(currentLng) : undefined,
        min_lat: minLat ? parseFloat(minLat) : undefined,
        max_lat: maxLat ? parseFloat(maxLat) : undefined,
        min_lng: minLng ? parseFloat(minLng) : undefined,
        max_lng: maxLng ? parseFloat(maxLng) : undefined,
        grid_size_km: gridSizeKm ? parseFloat(gridSizeKm) : undefined,
        top_n: topN ? parseInt(topN, 10) : undefined,
        survey_time_hours: surveyTimeHours ? parseFloat(surveyTimeHours) : undefined,
        surveyor_speed_kmh: surveyorSpeedKmh ? parseFloat(surveyorSpeedKmh) : undefined,
        influence_radius_km: influenceRadiusKm ? parseFloat(influenceRadiusKm) : undefined,
        spatial_weight: spatialWeight !== undefined ? parseFloat(spatialWeight) : undefined,
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`Error getting survey next point: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve survey next point');
    }
  }
}
