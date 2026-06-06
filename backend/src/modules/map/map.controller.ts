import { Controller, Get, Param, Query, InternalServerErrorException } from '@nestjs/common';
import { MapService } from './map.service';

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
      const allPois = await this.mapService.findAllPois();
      const categories = [...new Set(allPois.map(poi => poi.category))];
      return { success: true, data: categories };
    } catch (error) {
      console.error(`Error getting categories: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve categories');
    }
  }
}
