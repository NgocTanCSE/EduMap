// backend/src/modules/feature/feature.controller.ts
import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { Feature } from './feature.entity';

@Controller('features')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  findAll(): Promise<Feature[]> {
    return this.featureService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Feature> {
    const feature = await this.featureService.findOne(id);
    if (!feature) {
      throw new NotFoundException(`Feature with ID "${id}" not found`);
    }
    return feature;
  }

  @Post()
  create(@Body() createFeatureDto: Partial<Feature>): Promise<Feature> {
    return this.featureService.create(createFeatureDto);
  }

  // You might add PUT/PATCH for update and DELETE later
}
