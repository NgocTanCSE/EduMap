import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private readonly bucketName = 'edumap-library';

  constructor() {
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

  async uploadFile(fileName: string, file: Buffer, mimeType: string) {
    const timestamp = Date.now();
    const objectName = `${timestamp}-${fileName}`;
    
    await this.minioClient.putObject(this.bucketName, objectName, file, {
      'Content-Type': mimeType,
    });
    
    // Return relative URL or public URL
    const host = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
    return {
      fileName: objectName,
      url: `${host}/${this.bucketName}/${objectName}`,
    };
  }

  async deleteFile(fileName: string) {
    await this.minioClient.removeObject(this.bucketName, fileName);
  }
}
