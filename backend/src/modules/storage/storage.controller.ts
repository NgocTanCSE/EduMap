import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Get, Param, Delete, Request, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('my-files')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tập tin đã tải lên của người dùng' })
  async getMyFiles(@Request() req: any) {
    return this.storageService.getUserFiles(req.user.id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải lên tập tin lên MinIO' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.uploadFile(req.user.id, file.originalname, file.buffer, file.mimetype);
  }

  @Public()
  @Get('media/:objectName')
  @ApiOperation({ summary: 'Phục vụ file tĩnh từ MinIO (dùng cho avatar, CV...)' })
  async serveFile(@Param('objectName') objectName: string, @Res() res: Response) {
    try {
      const buffer = await this.storageService.serveFile(objectName);
      // Đặt Content-Type đúng dựa trên phần mở rộng file
      const ext = objectName.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'pdf': 'application/pdf', 'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      res.set('Content-Length', buffer.length.toString());
      res.send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Không tìm thấy tập tin');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tập tin khỏi MinIO và Database' })
  async deleteFile(@Request() req: any, @Param('id') fileId: string) {
    return this.storageService.deleteFile(req.user.id, fileId);
  }
}
