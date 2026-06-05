import { IsString, IsNotEmpty, IsNumber, IsOptional, IsLatitude, IsLongitude } from 'class-validator';

export class CreateMapPointDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  type_id: number;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateMapPointDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  type_id?: number;

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
  description?: string;

  @IsString()
  @IsOptional()
  status?: 'pending' | 'approved' | 'rejected';
}
