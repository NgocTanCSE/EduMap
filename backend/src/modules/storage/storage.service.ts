import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UserFile } from './entities/user-file.entity';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(UserFile) private readonly fileRepo: Repository<UserFile>
  ) {
    this.uploadDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`FileSystem storage ready at: ${this.uploadDir}`);
    } catch (error: any) {
      this.logger.warn(`StorageService: Could not create upload directory (${(error as Error).message}). Storage disabled.`);
    }
  }

  async uploadFile(userId: string, fileName: string, file: Buffer, mimeType: string) {
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${timestamp}-${safeName}`;
    const filePath = path.join(this.uploadDir, objectName);

    await fs.writeFile(filePath, file);

    const fileUrl = `/api/storage/media/${objectName}`;

    const userFile = this.fileRepo.create({
      user_id: userId,
      original_name: fileName,
      file_url: fileUrl,
      mime_type: mimeType,
      size_kb: parseFloat((file.length / 1024).toFixed(2)),
    });

    await this.fileRepo.save(userFile);

    return {
      id: userFile.id,
      original_name: fileName,
      file_url: fileUrl,
      mime_type: mimeType,
      size_kb: userFile.size_kb,
      created_at: userFile.created_at,
    };
  }

  async getUserFiles(userId: string) {
    return this.fileRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' }
    });
  }

  /**
   * Serve một file từ filesystem (để frontend truy cập trực tiếp qua NGINX)
   */
  async serveFile(objectName: string): Promise<Buffer> {
    const safeName = objectName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(this.uploadDir, safeName);

    try {
      return await fs.readFile(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('Không tìm thấy tập tin');
      }
      this.logger.error('Error serving file:', error);
      throw new NotFoundException('Không tìm thấy tập tin');
    }
  }

  async deleteFile(userId: string, fileId: string) {
    const userFile = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!userFile) {
      throw new NotFoundException('Không tìm thấy tập tin');
    }
    if (userFile.user_id !== userId) {
      throw new BadRequestException('Bạn không có quyền xóa tập tin này');
    }

    try {
      const objectName = userFile.file_url.split('/').pop();
      if (objectName) {
        const filePath = path.join(this.uploadDir, objectName.replace(/[^a-zA-Z0-9.-]/g, '_'));
        try {
          await fs.unlink(filePath);
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }
      }
      await this.fileRepo.remove(userFile);
      return { success: true, message: 'Đã xóa tập tin' };
    } catch (error: any) {
      this.logger.error('Error deleting file:', error);
      throw new BadRequestException('Lỗi khi xóa tập tin');
    }
  }
}
