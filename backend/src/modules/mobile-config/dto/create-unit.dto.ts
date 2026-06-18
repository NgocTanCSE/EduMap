import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMobileUnitDto {
  @ApiProperty({ example: 'Xe thư viện di động', description: 'Mobile unit name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Xe thư viện lưu động phục vụ cộng đồng', description: 'Unit description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'library', description: 'Unit type' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '107.1825', description: 'Current longitude' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '10.9567', description: 'Current latitude' })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ example: ['Sách thiếu nhi', 'Máy tính xách tay'], description: 'Available resources' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional({ example: '08:00-17:00', description: 'Operating hours' })
  @IsOptional()
  @IsString()
  operating_hours?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether unit is currently active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateLocationDto {
  @ApiProperty({ example: '107.1830', description: 'New longitude' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '10.9570', description: 'New latitude' })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ example: 'Đang di chuyển đến trường THCS Bình Long', description: 'Location notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PlanRouteDto {
  @ApiProperty({ example: '107.1900', description: 'Destination longitude' })
  @IsNumber()
  destination_longitude: number;

  @ApiProperty({ example: '10.9600', description: 'Destination latitude' })
  @IsNumber()
  destination_latitude: number;

  @ApiPropertyOptional({ example: 'Trường THCS Bình Long', description: 'Destination name' })
  @IsOptional()
  @IsString()
  destination_name?: string;
}
