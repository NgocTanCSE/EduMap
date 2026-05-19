import { Controller, Get, Post, Body, Query, UseInterceptors, UploadedFile, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { LibraryService } from './library.service';

@ApiTags('Library')
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm tài liệu học tập' })
  async search(
    @Query('q') q: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
  ) {
    return this.libraryService.search(q, category, type);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Tải lên tài liệu mới' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.libraryService.uploadMaterial(body, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết tài liệu' })
  async getDetail(@Param('id') id: string) {
    return this.libraryService.getDetail(id);
  }
}
