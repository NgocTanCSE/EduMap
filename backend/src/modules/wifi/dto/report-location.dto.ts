import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportWifiLocationDto {
  @ApiProperty({ example: 'WiFi quán Café ABC', description: 'WiFi location name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '107.1825', description: 'Longitude coordinate' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '10.9567', description: 'Latitude coordinate' })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ example: '123 Đường ABC, Biên Hòa', description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 50, description: 'Speed in Mbps' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed_mbps?: number;

  @ApiProperty({ example: true, description: 'Whether WiFi is free' })
  @IsBoolean()
  is_free: boolean;

  @ApiPropertyOptional({ example: 'wifi123456', description: 'WiFi password (if known)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'Mật khẩu treo trên quầy', description: 'Password hint' })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({ example: 'FPT Telecom', description: 'WiFi provider' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class SpeedTestDto {
  @ApiProperty({ example: 25.5, description: 'Download speed in Mbps' })
  @IsNumber()
  @Min(0)
  download_speed: number;

  @ApiProperty({ example: 10.2, description: 'Upload speed in Mbps' })
  @IsNumber()
  @Min(0)
  upload_speed: number;

  @ApiPropertyOptional({ example: '192.168.1.1', description: 'IP address (optional)' })
  @IsOptional()
  @IsString()
  ip_address?: string;
}
