import { Controller, Get, Post, Param, Query, Body, InternalServerErrorException, BadRequestException, NotFoundException, ValidationPipe, UseGuards } from '@nestjs/common';

import { SkipThrottle } from '@nestjs/throttler';

import { MapService } from './map.service';

import { AiAnalysisDto } from './dto/ai-analysis.dto';

import { CreateMapPointDto } from './dto/create-map-point.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';



@Controller('map')

export class MapController {

  constructor(private readonly mapService: MapService) {}



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
}
