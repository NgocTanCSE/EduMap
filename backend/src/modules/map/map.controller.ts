import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, Request, Patch, Delete } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MapService } from './map.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@ApiTags('MOD-MAP: Bản đồ giáo dục thông minh')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('locations')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) 
  @ApiOperation({ summary: 'Lấy tất cả các địa điểm đã xác minh' })
  async getLocations(@Query('categoryId') categoryId?: number) {
    return this.mapService.getLocations(categoryId);
  }

  @Get('categories')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600)
  @ApiOperation({ summary: 'Lấy danh sách các loại hình địa điểm' })
  async getCategories() {
    return this.mapService.getCategories();
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm địa điểm theo từ khóa, bán kính hoặc vùng nhìn' })
  async search(
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('swLat') swLat?: string,
    @Query('swLng') swLng?: string,
    @Query('neLat') neLat?: string,
    @Query('neLng') neLng?: string,
  ) {
    // 1. Tìm theo vùng nhìn (Map Bounds)
    if (swLat && swLng && neLat && neLng) {
        return this.mapService.findInBounds(
            Number(swLat), Number(swLng), 
            Number(neLat), Number(neLng)
        );
    }

    // 2. Tìm theo bán kính (Nearby)
    if (lat && lng) {
      return this.mapService.findNearby(
        Number(lat),
        Number(lng),
        radius ? Number(radius) : undefined,
      );
    }

    // 3. Tìm theo từ khóa
    return this.mapService.searchLocations(q || '');
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một địa điểm' })
  async getLocation(@Param('id') id: string) {
    return this.mapService.getLocationById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('locations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng góp địa điểm mới (Crowdsourcing)' })
  async createLocation(@Body() body: CreateLocationDto, @Request() req) {
    return this.mapService.createLocation(body, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('locations/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin địa điểm (Admin)' })
  async updateLocation(@Param('id') id: string, @Body() data: UpdateLocationDto) {
    return this.mapService.updateLocation(id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('locations/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa địa điểm (Admin)' })
  async deleteLocation(@Param('id') id: string) {
    await this.mapService.deleteLocation(id);
    return { success: true, message: 'Đã xóa địa điểm' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('ai-analysis')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Phân tích mật độ giáo dục bằng AI Gemini' })
  async analyzeGeo(@Body('city') city: string) {
    return this.mapService.analyzeEducationDensity(city);
  }
}
