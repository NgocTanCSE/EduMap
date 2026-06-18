import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStemLabDto {
  @ApiProperty({ example: 'Phòng thí nghiệm Vật lý', description: 'Lab name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '107.1825', description: 'Longitude coordinate' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: '10.9567', description: 'Latitude coordinate' })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ example: 'DNTU, Tầng 3, Phòng 301', description: 'Specific location text' })
  @IsOptional()
  @IsString()
  location_point_text?: string;

  @ApiPropertyOptional({ example: 'Phòng thí nghiệm hiện đại với đầy đủ trang thiết bị', description: 'Lab description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['Máy viễn vọng', 'Máy đo bức xạ', 'Bộ dụng cụ实验'], description: 'Lab equipment' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @ApiPropertyOptional({ example: 30, description: 'Lab capacity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: true, description: 'Whether booking is available' })
  @IsOptional()
  @IsBoolean()
  booking_available?: boolean;

  @ApiPropertyOptional({ example: ['https://example.com/photo1.jpg'], description: 'Lab photos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ example: 'Nguyễn Văn A - 0901234567', description: 'Contact information' })
  @IsOptional()
  @IsString()
  contact?: string;
}

export class BookLabDto {
  @ApiProperty({ example: '2026-07-15T09:00:00+07:00', description: 'Booking start time' })
  @IsString()
  @IsNotEmpty()
  start_time: string;

  @ApiProperty({ example: '2026-07-15T12:00:00+07:00', description: 'Booking end time' })
  @IsString()
  @IsNotEmpty()
  end_time: string;

  @ApiPropertyOptional({ example: 'Mượn phòng cho buổi thực hành môn Vật lý', description: 'Booking notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: ['Máy viễn vọng', 'Bộ dụng cụ实验'], description: 'Equipment to book' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];
}
