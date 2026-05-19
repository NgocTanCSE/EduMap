import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-COMMUNITY: Cộng đồng học tập')
@Controller('api/community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Lấy danh sách các bài viết thảo luận' })
  async getPosts() {
    return this.communityService.getPosts();
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-18: Đăng bài thảo luận mới' })
  async createPost(@Request() req: any, @Body() data: any) {
    return this.communityService.createPost(req.user.id, data);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Lấy danh sách bình luận của bài đăng theo ID' })
  async getComments(@Param('id') id: string) {
    return this.communityService.getCommentsByPostId(id);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-18: Thêm bình luận thảo luận' })
  async addComment(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.communityService.addComment(req.user.id, id, body.content);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Lấy danh sách các nhóm học tập công cộng' })
  async getGroups() {
    return this.communityService.getGroups();
  }

  @Post('groups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo nhóm học tập mới' })
  async createGroup(@Request() req: any, @Body() data: any) {
    return this.communityService.createGroup(req.user.id, data);
  }

  @Post('groups/:id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tham gia nhóm học tập' })
  async joinGroup(@Request() req: any, @Param('id') id: string) {
    return this.communityService.joinGroup(req.user.id, id);
  }
}
