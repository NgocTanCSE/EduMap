import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from './entities/learning-material.entity';
import { AIService } from '../ai/ai.service';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LearningMaterial) private readonly materialRepo: Repository<LearningMaterial>,
    private readonly aiService: AIService,
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
      // Use LIKE + LOWER() instead of ILIKE.
      // ILIKE is PostgreSQL-only and throws SQLITE_ERROR on SQLite (HF Spaces mode).
      // LOWER() + LIKE is standard SQL supported by both PostgreSQL and SQLite.
      qb = qb.andWhere('(LOWER(material.title) LIKE LOWER(:query) OR LOWER(material.description) LIKE LOWER(:query))', params);
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
    const saved = await this.materialRepo.save(newItem) as unknown as LearningMaterial;
    // TỰ ĐỘNG NHÚNG (Embed) sách mới vào Vector DB ngay — thay vì triggerKnowledgeSync()
    // (full re-sync), chỉ nhúng tài liệu vừa tạo để RAG tìm thấy ngay lập tức.
    const docText = `Tai lieu hoc tap: ${saved.title}. ` +
      `The loai / Nganh: ${saved.type || saved.subject || 'Chung'}. ` +
      `Lop / khoi: ${saved.grade || 'Chung'}. ` +
      `Tac gia (author_id): ${saved.author_id || 'DNTU'}. ` +
      `Tom tat noi dung: ${saved.description || ''}.`;
    this.aiService.embedDocument(
      docText,
      { title: saved.title, category: 'library', source: 'db_learning_materials',
        type: saved.type, subject: saved.subject },
      `material_${saved.id}`
    );
    return saved;
  }
}
