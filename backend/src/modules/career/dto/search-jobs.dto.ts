import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobType } from '../entities/job.entity';
import { Type } from 'class-transformer';

export class SearchJobsDto {
  @ApiProperty({ description: 'Từ khóa tìm kiếm (tiêu đề, mô tả, tên công ty)', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: 'Địa điểm', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Loại hình công việc', enum: JobType, required: false })
  @IsOptional()
  @IsEnum(JobType)
  job_type?: JobType;

  @ApiProperty({ description: 'Cấp độ kinh nghiệm', required: false })
  @IsOptional()
  @IsString()
  experience_level?: string;

  @ApiProperty({ description: 'Khoảng lương', required: false })
  @IsOptional()
  @IsString()
  salary_range?: string;

  @ApiProperty({ description: 'ID lộ trình nghề nghiệp', required: false })
  @IsOptional()
  @IsString()
  career_path_id?: string;

  @ApiProperty({ description: 'Trang hiện tại', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Số lượng kết quả mỗi trang', default: 10, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
