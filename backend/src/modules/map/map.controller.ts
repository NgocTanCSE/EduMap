import { Controller, Get, Post, Param, Query, Body, InternalServerErrorException, BadRequestException, ValidationPipe, UseGuards } from '@nestjs/common';
import { MapService } from './map.service';
import { AiAnalysisDto } from './dto/ai-analysis.dto';
import { CreateMapPointDto } from './dto/create-map-point.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('pois')
  async getAllPois(
    @Query('category') category?: string,
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string
  ) {
    try {
      if (category) {
        const filteredPois = await this.mapService.findPoisByCategory(category);
        return { success: true, data: filteredPois };
      }
      
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
    } catch (error) {
      console.error(`Error getting points of interest: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve points of interest');
    }
  }

  @Get('locations')
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
    } catch (error) {
      console.error(`Error getting locations: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve locations');
    }
  }

  @Get('categories')
  async getCategories() {
    try {
      const categories = await this.mapService.getCategories();
      return { success: true, data: categories };
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      console.error(`Error during AI map analysis: ${error.message}`);
      throw new InternalServerErrorException('An error occurred while processing the AI request');
    }
  }
}
