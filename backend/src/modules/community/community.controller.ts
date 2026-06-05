import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('MOD-COMMUNITY: Cộng đồng học tập')
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Lấy danh sách các bài viết thảo luận' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPosts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.communityService.getPosts(page, limit);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-18: Đăng bài thảo luận mới (Có kiểm duyệt AI)' })
  async createPost(@Request() req: any, @Body() data: CreatePostDto) {
    return this.communityService.createPost(req.user.id, data);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một bài đăng' })
  async getPostById(@Param('id') id: string) {
    return this.communityService.getPostById(id);
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thích một bài viết' })
  async likePost(@Param('id') id: string, @Request() req: any) {
    return this.communityService.likePost(id, req.user.id);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Lấy danh sách bình luận của bài đăng theo ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getComments(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.communityService.getCommentsByPostId(id, page, limit);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-18: Thêm bình luận thảo luận (Có kiểm duyệt AI)' })
  async addComment(@Param('id') id: string, @Request() req: any, @Body() body: CreateCommentDto) {
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

  // --- MODERATION ENDPOINTS ---

  @Get('moderation/posts')
  @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN) // Should use RolesGuard
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bài viết chờ duyệt' })
  async getPendingPosts() {
    return this.communityService.getPendingPosts();
  }

  @Post('moderation/posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt hoặc từ chối bài viết' })
  async moderatePost(@Param('id') id: string, @Body('action') action: 'approve' | 'reject') {
    return this.communityService.moderatePost(id, action);
  }

  @Get('moderation/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bình luận chờ duyệt' })
  async getPendingComments() {
    return this.communityService.getPendingComments();
  }

  @Post('moderation/comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt hoặc từ chối bình luận' })
  async moderateComment(@Param('id') id: string, @Body('action') action: 'approve' | 'reject') {
    return this.communityService.moderateComment(id, action);
  }
}
