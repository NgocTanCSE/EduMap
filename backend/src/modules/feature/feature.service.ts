// backend/src/modules/feature/feature.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature } from './feature.entity';

@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Feature)
    private featureRepository: Repository<Feature>,
  ) {}

  findAll(): Promise<Feature[]> {
    return this.featureRepository.find();
  }

  findOne(id: string): Promise<Feature> {
    return this.featureRepository.findOne({ where: { id } });
  }

  create(feature: Partial<Feature>): Promise<Feature> {
    const newFeature = this.featureRepository.create(feature);
    return this.featureRepository.save(newFeature);
  }
  
  // You might add update, delete methods later
}
