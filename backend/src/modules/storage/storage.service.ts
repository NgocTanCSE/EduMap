import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Minio from 'minio';
import { UserFile } from './entities/user-file.entity';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private readonly bucketName = 'edumap-library';

  constructor(
    @InjectRepository(UserFile) private readonly fileRepo: Repository<UserFile>
  ) {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
      secretKey: process.env.MINIO_SECRET_KEY || 'password123',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Bucket '${this.bucketName}' created successfully.`);
      }
    } catch (error) {
      this.logger.error('Error initializing MinIO:', error);
    }
  }

  async uploadFile(userId: string, fileName: string, file: Buffer, mimeType: string) {
    const timestamp = Date.now();
    // Normalize filename to prevent MinIO issues
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectName = `${timestamp}-${safeName}`;
    
    await this.minioClient.putObject(this.bucketName, objectName, file, {
      'Content-Type': mimeType,
    });
    
    const fileUrl = `/media/${objectName}`;

    // Save to database
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
      fileName: objectName,
      url: fileUrl,
      original_name: fileName,
      size_kb: userFile.size_kb
    };
  }

  async getUserFiles(userId: string) {
      return this.fileRepo.find({
          where: { user_id: userId },
          order: { created_at: 'DESC' }
      });
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
            await this.minioClient.removeObject(this.bucketName, objectName);
        }
        await this.fileRepo.remove(userFile);
        return { success: true, message: 'Đã xóa tập tin' };
    } catch (error) {
        this.logger.error('Error deleting file:', error);
        throw new BadRequestException('Lỗi khi xóa tập tin');
    }
  }
}
