import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningMaterial } from './entities/learning-material.entity';
import { UserLearningHistory } from './entities/user-learning-history.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LearningMaterial)
    private materialRepo: Repository<LearningMaterial>,
    @InjectRepository(UserLearningHistory)
    private historyRepo: Repository<UserLearningHistory>,
    private storageService: StorageService,
    private aiService: AIService,
  ) { }

  /**
   * Lưu lịch sử học tập
   */
  async recordViewHistory(userId: string, materialId: string) {
    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    // Tìm lịch sử cũ
    let history = await this.historyRepo.findOne({
      where: { user: { id: userId } as any, material: { id: materialId } as any }
    });

    if (history) {
      history.last_accessed = new Date();
    } else {
      history = new UserLearningHistory();
      (history as any).user = { id: userId };
      (history as any).material = { id: materialId };
      (history as any).status = 'in_progress';
      (history as any).progress_percentage = 10;
    }

    return this.historyRepo.save(history);
  }

  /**
   * AI Sinh tóm tắt và lộ trình học cho tài liệu
   */
  async generateMaterialSummary(materialId: string) {
    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    // Chuyển dữ liệu sang AI Service
    return this.aiService.summarizeMaterial({
      title: material.title,
      description: material.description,
      category: material.category,
      tags: material.tags,
      type: material.type
    });
  }

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
    const uploadResult = await this.storageService.uploadFile('system',
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

  /**
   * Cập nhật thông tin tài liệu
   */
  async updateMaterial(id: string, data: any) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');
    
    Object.assign(material, data);
    return this.materialRepo.save(material);
  }

  /**
   * Xóa tài liệu
   */
  async deleteMaterial(id: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Tài liệu không tồn tại');

    if (material.file_name) {
      try {
        await this.storageService.deleteFile('system', material.file_name);
      } catch (e) {
        // Log error but continue deleting db record
      }
    }

    return this.materialRepo.remove(material);
  }
}
