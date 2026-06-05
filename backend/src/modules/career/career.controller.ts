import { Controller, Get, Post, Body, Query, Param, UseGuards, Request, Patch, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CareerService } from './career.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { CreateUserCareerDto } from './dto/create-user-career.dto';
import { UpdateUserCareerDto } from './dto/update-user-career.dto';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { UpdateUserSkillDto } from './dto/update-user-skill.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { ApplicationStatus } from './entities/application.entity';

@ApiTags('Career')
@Controller('career')
export class CareerController {
  constructor(private readonly careerService: CareerService) {}

  // =====================================
  //  CareerPath Endpoints
  // =====================================

  @Post('paths')
  @ApiOperation({ summary: 'Tạo lộ trình nghề nghiệp mới' })
  async createPath(@Body() data: any) {
    return this.careerService.createCareerPath(data);
  }

  @Get('paths')
  @ApiOperation({ summary: 'Lấy danh sách các lộ trình nghề nghiệp' })
  async getPaths(@Query('field') field: string) {
    return this.careerService.getCareerPaths(field);
  }

  @Get('paths/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một lộ trình nghề nghiệp' })
  async getPathById(@Param('id') id: string) {
    return this.careerService.getCareerPathById(id);
  }

  @Get('roadmap/:id')
  @ApiOperation({ summary: 'Lấy chi tiết roadmap kỹ năng của một nghề nghiệp' })
  async getRoadmap(@Param('id') id: string) {
    return this.careerService.getSkillRoadmap(id);
  }

  // =====================================
  //  Job/Opportunity Endpoints
  // =====================================

  @Get('jobs')
  @ApiOperation({ summary: 'Tìm kiếm và lọc các cơ hội việc làm/khóa học' })
  async searchJobs(@Query() searchDto: SearchJobsDto) {
    return this.careerService.searchJobs(searchDto);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một Job/Cơ hội' })
  async getJobById(@Param('id') id: string) {
    return this.careerService.getJobById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('jobs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng tuyển dụng mới' })
  async createJob(@Body() createJobDto: CreateJobDto, @Request() req) {
    return this.careerService.createJob(createJobDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('jobs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin tuyển dụng' })
  async updateJob(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto, @Request() req) {
    return this.careerService.updateJob(id, updateJobDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('jobs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bài đăng tuyển dụng' })
  async deleteJob(@Param('id') id: string, @Request() req) {
    return this.careerService.deleteJob(id, req.user.id);
  }

  // =====================================
  //  UserCareer (Aspirations) Endpoints
  // =====================================

  @UseGuards(JwtAuthGuard)
  @Get('user-careers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách nguyện vọng nghề nghiệp của bản thân' })
  async getUserCareers(@Request() req) {
    return this.careerService.getUserCareers(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('user-careers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm nguyện vọng nghề nghiệp mới' })
  async createUserCareer(@Body() createUserCareerDto: CreateUserCareerDto, @Request() req) {
    return this.careerService.createUserCareer(req.user.id, createUserCareerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('user-careers/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật nguyện vọng nghề nghiệp' })
  async updateUserCareer(@Param('id') id: string, @Body() updateUserCareerDto: UpdateUserCareerDto, @Request() req) {
    return this.careerService.updateUserCareer(id, req.user.id, updateUserCareerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('user-careers/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa nguyện vọng nghề nghiệp' })
  async deleteUserCareer(@Param('id') id: string, @Request() req) {
    return this.careerService.deleteUserCareer(id, req.user.id);
  }

  // =====================================
  //  UserSkill Endpoints
  // =====================================

  @UseGuards(JwtAuthGuard)
  @Get('user-skills')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng của bản thân' })
  async getUserSkills(@Request() req) {
    return this.careerService.getUserSkills(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('user-skills')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm kỹ năng mới' })
  async createUserSkill(@Body() createUserSkillDto: CreateUserSkillDto, @Request() req) {
    return this.careerService.createUserSkill(req.user.id, createUserSkillDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('user-skills/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật cấp độ thành thạo kỹ năng' })
  async updateUserSkill(@Param('id') id: string, @Body() updateUserSkillDto: UpdateUserSkillDto, @Request() req) {
    return this.careerService.updateUserSkill(id, req.user.id, updateUserSkillDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('user-skills/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa kỹ năng khỏi hồ sơ' })
  async deleteUserSkill(@Param('id') id: string, @Request() req) {
    return this.careerService.deleteUserSkill(id, req.user.id);
  }

  // =====================================
  //  Application Endpoints
  // =====================================

  @UseGuards(JwtAuthGuard)
  @Get('applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử ứng tuyển của bản thân' })
  async getUserApplications(@Request() req) {
    return this.careerService.getUserApplications(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('applications/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết một đơn ứng tuyển' })
  async getApplicationById(@Param('id') id: string, @Request() req) {
    return this.careerService.getApplicationById(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nộp đơn ứng tuyển vào một Job/Cơ hội' })
  async applyToJob(@Body() applyJobDto: ApplyJobDto, @Request() req) {
    return this.careerService.applyToJob(req.user.id, applyJobDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('applications/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái ứng tuyển (Dành cho nhà tuyển dụng/Admin)' })
  async updateApplicationStatus(
    @Param('id') id: string, 
    @Body('status') status: ApplicationStatus, 
    @Request() req
  ) {
    return this.careerService.updateApplicationStatus(id, status, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('applications/:id/withdraw')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rút đơn ứng tuyển' })
  async withdrawApplication(@Param('id') id: string, @Request() req) {
    return this.careerService.withdrawApplication(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-resume')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải lên CV/Resume' })
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    return this.careerService.uploadResume(file);
  }

  // =====================================
  //  AI & Suggestion Endpoints
  // =====================================

  @UseGuards(JwtAuthGuard)
  @Post('suggest')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gợi ý nghề nghiệp dựa trên hồ sơ kỹ năng hiện có' })
  async suggest(@Request() req) {
    return this.careerService.suggestCareer(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ai-advice')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy tư vấn nghề nghiệp chuyên sâu từ AI Gemini' })
  async getAIAdvice(@Request() req) {
    return this.careerService.getAICareerAdvice(req.user.id);
  }
}
