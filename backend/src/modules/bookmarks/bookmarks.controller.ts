import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookmarksService } from './bookmarks.service';
import { CreateBookmarkDto } from './dto/bookmark.dto';
import { BookmarkTargetType } from './entities/bookmark.entity';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bookmark (được join title theo loại) của người dùng, có thể lọc qua ?type=' })
  async list(@Request() req, @Query('type') type?: BookmarkTargetType) {
    const items = await this.bookmarksService.listBookmarksDetailed(req.user.id, type);
    return { items };
  }

  @Post()
  @ApiOperation({ summary: 'Bật/tắt (toggle) một bookmark cho đối tượng' })
  async toggle(@Request() req, @Body() dto: CreateBookmarkDto) {
    const bookmarked = await this.bookmarksService.toggleBookmark(req.user.id, dto);
    return { bookmarked, target_type: dto.target_type, target_id: dto.target_id };
  }
}
