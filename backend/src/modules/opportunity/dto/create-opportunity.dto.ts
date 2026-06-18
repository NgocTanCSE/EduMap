import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Học bổng STEM Việt Nam', description: 'Opportunity title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Học bổng dành cho sinh viên ngành STEM', description: 'Opportunity description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'scholarship', description: 'Opportunity type', enum: ['scholarship', 'internship', 'hackathon', 'research', 'volunteer', 'job', 'other'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['scholarship', 'internship', 'hackathon', 'research', 'volunteer', 'job', 'other'])
  type: string;

  @ApiProperty({ example: 'Quỹ STEM Việt Nam', description: 'Organization name' })
  @IsString()
  @IsNotEmpty()
  organization: string;

  @ApiProperty({ example: '2026-12-31', description: 'Application deadline' })
  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @ApiPropertyOptional({ example: 'GPA >= 3.0, Sinh viên năm 2-3', description: 'Requirements' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ example: 'Học bổng 50 triệu đồng, cơ hội thực tập', description: 'Benefits' })
  @IsOptional()
  @IsString()
  benefits?: string;

  @ApiPropertyOptional({ example: 'https://example.com/apply', description: 'Application URL' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: ['STEM', 'Technology', 'Engineering'], description: 'Field tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  field_tags?: string[];

  @ApiPropertyOptional({ example: 'Southern Vietnam', description: 'Region' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: '107.1825', description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: '10.9567', description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  latitude?: number;
}
