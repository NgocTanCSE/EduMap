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
      endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ROOT_USER || 'admin',
      secretKey: process.env.MINIO_ROOT_PASSWORD || 'password123',
    });
  }

  async onModuleInit() {
    // MinIO may be unavailable in local/dev environments (no server running on
    // 127.0.0.1:9000). The MinIO SDK can hang indefinitely on a refused/closed
    // port (internal retry loop), which would block the entire NestJS bootstrap.
    // Race the init against a timeout so the app always boots and storage only
    // degrades gracefully instead of stalling startup.
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MinIO initialization timed out (5s)')), 5000),
      );
      const init = (async () => {
        const exists = await this.minioClient.bucketExists(this.bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(this.bucketName);
          this.logger.log(`Bucket '${this.bucketName}' created successfully.`);
        } else {
          this.logger.log(`MinIO bucket '${this.bucketName}' exists.`);
        }
      })();
      await Promise.race([init, timeout]);
    } catch (error) {
      this.logger.warn(`StorageService: MinIO unavailable, storage disabled (${(error as Error).message}).`);
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
    
    const fileUrl = `/api/storage/media/${objectName}`;

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
   * Stream một file từ MinIO ra response HTTP (để frontend truy cập trực tiếp)
   */
  async serveFile(objectName: string): Promise<Buffer> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        throw new NotFoundException('Bucket không tồn tại');
      }
      const data = await this.minioClient.getObject(this.bucketName, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
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
