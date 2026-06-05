import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InternshipService } from './internship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-INTERN: Internship Map')
@Controller('internships')
export class InternshipController {
  constructor(private readonly internService: InternshipService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả các cơ hội thực tập đang mở' })
  async getInternships() {
    return this.internService.getInternships();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết cơ hội thực tập theo ID' })
  async getById(@Param('id') id: string) {
    if (id === 'nearby') return; // Ignore nearby route mapping to ID
    return this.internService.getInternshipById(id);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Tìm kiếm cơ hội thực tập gần đây qua bản đồ GIS PostGIS' })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.internService.getInternshipsNearby(Number(lat), Number(lng), radius ? Number(radius) : undefined);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng tuyển cơ hội thực tập mới' })
  async create(@Request() req: any, @Body() data: any) {
    return this.internService.createInternship(req.user.id, data);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp CV ứng tuyển thực tập' })
  async apply(
    @Request() req: any,
    @Param('id') id: string,
    @Body('coverLetter') letter: string,
  ) {
    return this.internService.applyInternship(req.user.id, id, letter);
  }
}
