import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from './entities/learning-material.entity';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LearningMaterial) private readonly materialRepo: Repository<LearningMaterial>,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    const [items, total] = await this.materialRepo.findAndCount({
      where: { deleted_at: null },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' }
    });
    
    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }
    };
  }

  async search(query: string, page: number = 1, limit: number = 10, category?: string, type?: string) {
    if (!query && !category && !type) return this.findAll(page, limit);
    
    let qb = this.materialRepo.createQueryBuilder('material')
      .where('material.deleted_at IS NULL');

    const params: any = {};
    if (query) {
      params.query = `%${query}%`;
      qb = qb.andWhere('(material.title ILIKE :query OR material.description ILIKE :query)', params);
    }
    if (category) {
      params.category = category;
      qb = qb.andWhere('material.subject = :category', params);
    }
    if (type) {
      params.type = type;
      qb = qb.andWhere('material.type = :type', params);
    }
    
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('material.created_at', 'DESC')
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }
    };
  }

  async findOne(id: string): Promise<LearningMaterial> {
    const item = await this.materialRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Library item with ID "${id}" not found`);
    }
    return item;
  }

  async create(data: any): Promise<LearningMaterial> {
    const newItem = this.materialRepo.create(data);
    return this.materialRepo.save(newItem) as unknown as Promise<LearningMaterial>;
  }
}
