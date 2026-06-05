// backend/src/modules/module/module.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from './module.entity';

@Injectable()
export class ModuleService {
  constructor(
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
  ) {}

  findAll(): Promise<Module[]> {
    return this.moduleRepository.find();
  }

  findOne(id: string): Promise<Module> {
    return this.moduleRepository.findOne({ where: { id } });
  }

  create(module: Partial<Module>): Promise<Module> {
    const newModule = this.moduleRepository.create(module);
    return this.moduleRepository.save(newModule);
  }
  
  // You might add update, delete methods later
}
