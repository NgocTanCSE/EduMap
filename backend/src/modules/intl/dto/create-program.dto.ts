import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProgramDto {
  @ApiProperty({ example: 'Trao đổi sinh viên Nhật Bản', description: 'Program title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Chương trình trao đổi sinh viên với Đại học Tokyo', description: 'Program description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'University of Tokyo', description: 'Partner institution' })
  @IsString()
  @IsNotEmpty()
  institution: string;

  @ApiProperty({ example: 'Japan', description: 'Country' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: '2026-09-01', description: 'Program start date' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2027-02-28', description: 'Program end date' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiProperty({ example: 10, description: 'Number of available slots' })
  @IsNumber()
  @Min(1)
  slots: number;

  @ApiPropertyOptional({ example: 'IELTS 6.5+, GPA 3.0+', description: 'Requirements' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'https://example.com/apply', description: 'Application URL' })
  @IsOptional()
  @IsString()
  apply_url?: string;
}

export class RegisterAlumniDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Alumni name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'University of Tokyo', description: 'University studied at' })
  @IsString()
  @IsNotEmpty()
  university: string;

  @ApiProperty({ example: 'Japan', description: 'Country' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: '2025-2026', description: 'Study period' })
  @IsString()
  @IsNotEmpty()
  study_period: string;

  @ApiPropertyOptional({ example: 'Kỹ sư phần mềm tại Google', description: 'Current position' })
  @IsOptional()
  @IsString()
  current_position?: string;

  @ApiPropertyOptional({ example: 'Tôi rất hài lòng với chương trình trao đổi', description: 'Experience sharing' })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg', description: 'Profile photo URL' })
  @IsOptional()
  @IsString()
  photo_url?: string;
}
