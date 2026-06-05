import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyJobDto {
  @ApiProperty({ description: 'ID của Job/Cơ hội muốn ứng tuyển' })
  @IsString()
  @IsNotEmpty()
  job_id: string;

  @ApiProperty({ description: 'Thư xin việc/Giới thiệu bản thân', required: false })
  @IsOptional()
  @IsString()
  cover_letter?: string;

  @ApiProperty({ description: 'URL đến CV/Resume (có thể từ Storage service)', required: false })
  @IsOptional()
  @IsString()
  // @IsUrl() // Optional URL validation
  resume_url?: string;
}
