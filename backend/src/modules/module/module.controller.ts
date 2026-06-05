// backend/src/modules/module/module.controller.ts
import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { ModuleService } from './module.service';
import { Module } from './module.entity';

@Controller('modules')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  findAll(): Promise<Module[]> {
    return this.moduleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Module> {
    const module = await this.moduleService.findOne(id);
    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }
    return module;
  }

  @Post()
  create(@Body() createModuleDto: Partial<Module>): Promise<Module> {
    return this.moduleService.create(createModuleDto);
  }

  // You might add PUT/PATCH for update and DELETE later
}
