import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInternshipDto {
  @ApiProperty({ example: 'Thực tập sinh phát triển phần mềm', description: 'Internship title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Thực tập phát triển ứng dụng web với React và Node.js', description: 'Internship description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Software Development', description: 'Internship field' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ example: '107.1825', description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: '10.9567', description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: '5-10 triệu/tháng', description: 'Salary range' })
  @IsOptional()
  @IsString()
  salary_range?: string;

  @ApiPropertyOptional({ example: '3 tháng', description: 'Duration' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ example: 'Yêu cầu kiến thức cơ bản về JavaScript', description: 'Requirements' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'Được mentor hướng dẫn, cơ hội tuyển dụng chính thức', description: 'Benefits' })
  @IsOptional()
  @IsString()
  benefits?: string;

  @ApiProperty({ example: '2026-08-31', description: 'Application deadline' })
  @IsDateString()
  @IsNotEmpty()
  deadline: string;
}

export class ApplyInternshipDto {
  @ApiProperty({ example: 'Em rất quan tâm đến vị trí thực tập này...', description: 'Cover letter' })
  @IsString()
  @IsNotEmpty()
  cover_letter: string;

  @ApiPropertyOptional({ example: 'https://example.com/cv.pdf', description: 'Resume URL' })
  @IsOptional()
  @IsString()
  resume_url?: string;
}
