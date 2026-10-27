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
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType, ResourceStatus } from '../entities/resource.entity';

export class CreateResourceDto {
  @ApiProperty({ enum: ResourceType, example: ResourceType.BOOK })
  @IsEnum(ResourceType)
  type: ResourceType;

  @ApiProperty({ example: 'Máy tính xách tay Dell Inspiron 15' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Máy cũ đã qua sử dụng 1 năm, cấu hình i5...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 4, description: 'Độ sẵn sàng (0–5 sao)', minimum: 0, maximum: 5 })
  @IsNumber()
  @Min(0)
  @Max(5)
  condition: number;

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

  @ApiPropertyOptional({ example: '2026-11-01T08:00:00Z' })
  @IsOptional()
  @IsString()
  available_from?: string;

  @ApiPropertyOptional({ example: 0, description: 'Chi phí (VND), 0 nếu miễn phí' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ example: 'nguyen@example.com' })
  @IsOptional()
  @IsString()
  contact_method?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @ApiPropertyOptional({ example: ['stem', 'education'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'c4a1b2d3-...' })
  @IsOptional()
  @IsUUID()
  created_by?: string;
}
