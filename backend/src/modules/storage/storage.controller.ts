import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Get, Param, Delete, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tập tin khỏi MinIO và Database' })
  async deleteFile(@Request() req: any, @Param('id') fileId: string) {
    return this.storageService.deleteFile(req.user.id, fileId);
  }
}
