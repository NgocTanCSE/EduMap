import { Controller, Get, Put, Post, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe, Req } from '@nestjs/common';


import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CrawlerService } from '../crawler/crawler.service';
import { AdminService } from './admin.service';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly adminService: AdminService,
  ) {}

  @Post('crawl-map')
  @ApiOperation({ summary: 'Kích hoạt thủ công Crawler để tìm địa điểm mới quanh DNTU' })
  async triggerMapCrawler() {
    return this.crawlerService.crawlDNTUSurroundings();
  }
  
  @Get('dashboard')
  @ApiOperation({ summary: 'Lấy thống kê Dashboard Admin' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Danh sách người dùng với phân trang và lọc' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách người dùng thành công' })
  async getUsers(@Query() query: UserQueryDto) {
    return this.adminService.findAllUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Chi tiết người dùng' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.findOneUser(id);
  }

  @Put('users/:id/status')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Thay đổi trạng thái người dùng (Ban/Unban)' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserStatusDto,
    @Req() req: any
  ) {
    return this.adminService.updateUserStatus(id, updateDto, req.user);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Xóa mềm người dùng' })
  async softDeleteUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.softDeleteUser(id, req.user);
  }

  @Post('users/:id/restore')
  @ApiOperation({ summary: 'Khôi phục người dùng đã xóa mềm' })
  async restoreUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.restoreUser(id, req.user);
  }

  @Get('content/pending')
  @ApiOperation({ summary: 'Danh sách nội dung chờ duyệt' })
  async getPendingContent(@Query('type') type: string) {
    return {
      type,
      items: [],
      count: 0
    };
  }
}
