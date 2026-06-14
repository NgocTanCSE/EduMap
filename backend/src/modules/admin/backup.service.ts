import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = join(process.cwd(), 'backups');

  constructor(private configService: ConfigService) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Tự động chạy vào 2 giờ sáng mỗi ngày
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDatabaseBackup() {
    this.logger.log('Starting automated database backup...');
    
    const host = this.configService.get<string>('DB_HOST') || 'localhost';
    const port = this.configService.get<string>('DB_PORT') || '5432';
    const user = this.configService.get<string>('DB_USERNAME') || 'admin';
    const dbName = this.configService.get<string>('DB_DATABASE') || 'edumap_db';
    const password = this.configService.get<string>('DB_PASSWORD') || 'password123';
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${dbName}-${timestamp}.sql`;
    const filePath = join(this.backupDir, fileName);

    // Sử dụng PGPASSWORD để tránh tương tác nhập mật khẩu
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -f "${filePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        this.logger.error(`Backup failed: ${error.message}`);
        return;
      }
      if (stderr && !stderr.includes('don\'t have a valid index')) {
        this.logger.warn(`Backup warning: ${stderr}`);
      }
      this.logger.log(`Backup successful: ${fileName}`);
      
      // Ở đây có thể thêm logic upload lên MinIO hoặc S3
      this.cleanupOldBackups();
    });
  }

  private cleanupOldBackups() {
    const files = fs.readdirSync(this.backupDir);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // Giữ lại backup trong 7 ngày

    files.forEach(file => {
      const filePath = join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted old backup: ${file}`);
      }
    });
  }
}
