import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from './entities/learning-material.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LearningMaterial)
    private materialRepo: Repository<LearningMaterial>,
    private storageService: StorageService,
  ) {}

  /**
   * Tìm kiếm học liệu nâng cao
   */
  async search(q: string, category?: string, type?: string) {
    const qb = this.materialRepo.createQueryBuilder('m');

    if (q) {
      const searchPattern = `%${q}%`;
      qb.andWhere('(m.title ILIKE :searchPattern OR m.description ILIKE :searchPattern)', { searchPattern });
    }
    if (category && category !== 'Tất cả') {
      qb.andWhere('m.category = :category', { category });
    }
    if (type) {
      qb.andWhere('m.type = :type', { type });
    }

    return qb.getMany();
  }

  /**
   * Tải lên tài liệu mới
   */
  async uploadMaterial(data: any, file: Express.Multer.File) {
    const uploadResult = await this.storageService.uploadFile(
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    const material = this.materialRepo.create({
      ...data,
      file_url: uploadResult.url,
      file_name: uploadResult.fileName,
      mime_type: file.mimetype,
      tags: data.tags ? (Array.isArray(data.tags) ? data.tags : [data.tags]) : [],
    });

    return this.materialRepo.save(material);
  }

  /**
   * Lấy chi tiết và tăng view
   */
  async getDetail(id: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');
    
    material.view_count += 1;
    return this.materialRepo.save(material);
  }
}
