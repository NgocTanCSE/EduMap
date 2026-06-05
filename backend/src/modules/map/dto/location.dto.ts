import { IsString, IsNotEmpty, IsNumber, IsOptional, IsLatitude, IsLongitude, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ description: 'Name of the location' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category ID' })
  @IsNumber()
  @IsNotEmpty()
  category_id: number;

  @ApiProperty({ description: 'Latitude' })
  @IsLatitude()
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  @IsLongitude()
  lng: number;

  @ApiProperty({ description: 'Detailed address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'Detailed description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'List of photo URLs', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  category_id?: number;

  @IsLatitude()
  @IsOptional()
  lat?: number;

  @IsLongitude()
  @IsOptional()
  lng?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsString()
  @IsOptional()
  status?: string;
}
