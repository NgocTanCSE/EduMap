import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NeedUrgency } from '../entities/sponsor-need.entity';

export class CreateSponsorNeedDto {
  @ApiProperty({ example: 'Xây thư viện STEM cho Trường THPT Trấn Biên', description: 'Tên nhu cầu' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Trường THPT Trấn Biên cần xây dựng thư viện STEM...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'education_equipment', description: 'Danh mục nhu cầu' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'high', enum: NeedUrgency, description: 'Mức độ khẩn cấp' })
  @IsString()
  @IsNotEmpty()
  urgency: NeedUrgency;

  @ApiProperty({ example: 200000000, description: 'Chi phí ước tính (VND)', minimum: 0 })
  @IsNumber()
  @Min(0)
  cost_estimate: number;

  @ApiPropertyOptional({ example: 'Biên Hòa, Đồng Nai' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: ['stem', 'education', 'library'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ example: 'https://dntu.edu.vn' })
  @IsOptional()
  @IsString()
  apply_url?: string;

  @ApiPropertyOptional({ example: 'c4a1b2d3-...' })
  @IsOptional()
  @IsUUID()
  created_by?: string;
}
