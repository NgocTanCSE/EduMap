import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLearningSpotDto {
  @ApiProperty({ example: 'Thư viện công cộng Biên Hòa', description: 'Spot name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '107.1825', description: 'Longitude' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '10.9567', description: 'Latitude' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 'Thư viện mở cửa từ 7h-21h, có wifi miễn phí', description: 'Spot description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: '123 Đường ABC, Biên Hòa', description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: ['wifi', 'air_conditioning', 'quiet_zone'], description: 'Amenities' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ example: 50, description: 'Capacity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: '07:00-21:00', description: 'Operating hours' })
  @IsOptional()
  @IsString()
  operating_hours?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether spot is currently available' })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}
