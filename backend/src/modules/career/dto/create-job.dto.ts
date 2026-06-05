import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobType, JobStatus } from '../entities/job.entity';

export class CreateJobDto {
  @ApiProperty({ description: 'Tiêu đề của công việc/khóa học' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Mô tả chi tiết công việc/khóa học' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Tên công ty hoặc tổ chức', required: false })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiProperty({ description: 'Địa điểm làm việc', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Loại hình công việc/khóa học', enum: JobType, default: JobType.FULL_TIME })
  @IsEnum(JobType)
  @IsOptional()
  job_type?: JobType;

  @ApiProperty({ description: 'Khoảng lương hoặc chi phí khóa học', required: false })
  @IsOptional()
  @IsString()
  salary_range?: string;

  @ApiProperty({ description: 'Các kỹ năng yêu cầu', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required_skills?: string[];

  @ApiProperty({ description: 'Cấp độ kinh nghiệm yêu cầu', required: false })
  @IsOptional()
  @IsString()
  experience_level?: string;

  @ApiProperty({ description: 'Hạn chót nộp hồ sơ', required: false })
  @IsOptional()
  @IsDateString()
  application_deadline?: Date;

  @ApiProperty({ description: 'ID của lộ trình nghề nghiệp liên quan', required: false })
  @IsOptional()
  @IsString()
  career_path_id?: string;
}
