import { Controller, Get, Post, Delete, Put, Body, Query, UseInterceptors, UploadedFile, Param, UseGuards } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Library')
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('search')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) 
  @ApiOperation({ summary: 'Tìm kiếm tài liệu học tập' })
  async search(
    @Query('q') q: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
  ) {
    return this.libraryService.search(q, category, type);
  }

  @Post('upload')
  // Vô hiệu hóa bảo mật để Demo
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải lên tài liệu mới' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.libraryService.uploadMaterial(body, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI sinh tóm tắt và lộ trình cho tài liệu' })
  async getMaterialSummary(@Param('id') id: string) {
    return this.libraryService.generateMaterialSummary(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết tài liệu' })
  async getDetail(@Param('id') id: string) {
    return this.libraryService.getDetail(id);
  }

  @Put(':id')
  // Vô hiệu hóa bảo mật để Demo
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tài liệu' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.libraryService.updateMaterial(id, data);
  }

  @Delete(':id')
  // Vô hiệu hóa bảo mật để Demo
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tài liệu' })
  async deleteMaterial(@Param('id') id: string) {
    await this.libraryService.deleteMaterial(id);
    return { success: true, message: 'Đã xóa tài liệu' };
  }
}
