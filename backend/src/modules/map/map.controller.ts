import { Controller, Get, Post, Param, Query, Body, InternalServerErrorException, BadRequestException, ValidationPipe } from '@nestjs/common';
import { MapService } from './map.service';
import { AiAnalysisDto } from './dto/ai-analysis.dto';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('pois')
  async getAllPois(@Query('category') category?: string) {
    try {
      if (category) {
        const filteredPois = await this.mapService.findPoisByCategory(category);
        return { success: true, data: filteredPois };
      }
      const allPois = await this.mapService.findAllPois();
      return { success: true, data: allPois };
    } catch (error) {
      console.error(`Error getting points of interest: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve points of interest');
    }
  }

  @Get('locations')
  async getLocations() {
    try {
      const allPois = await this.mapService.findAllPois();
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

  @Post('ai-analysis')
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
