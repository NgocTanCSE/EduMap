import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsUUID,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType } from '../entities/resource.entity';
import { RequestUrgency } from '../entities/resource-request.entity';

export class CreateResourceRequestDto {
  @ApiProperty({ enum: ResourceType, example: ResourceType.DEVICE })
  @IsEnum(ResourceType)
  need_type: ResourceType;

  @ApiProperty({ example: 'Cần 5 máy tính để phòng lab trường' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Trường THCS Nguyễn Trãi cần máy tính...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RequestUrgency, example: RequestUrgency.HIGH })
  @IsEnum(RequestUrgency)
  urgency: RequestUrgency;

  @ApiProperty({ example: 'Biên Hòa, Đồng Nai' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional({ example: 10.9525 })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 106.8778 })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: '2026-11-05T17:00:00Z' })
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Điều kiện tối thiểu (0–5)',
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  preferred_min_condition?: number;

  @ApiPropertyOptional({ example: 'nguyen@example.com' })
  @IsOptional()
  @IsString()
  contact_method?: string;

  @ApiPropertyOptional({ example: ['stem', 'computer'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'c4a1b2d3-...' })
  @IsOptional()
  @IsUUID()
  created_by?: string;
}
