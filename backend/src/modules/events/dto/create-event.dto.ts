import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString, IsArray, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Workshop Lập trình React', description: 'Event title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Workshop hướng dẫn lập trình React từ cơ bản đến nâng cao', description: 'Event description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'workshop', description: 'Event type', enum: ['workshop', 'hackathon', 'seminar', 'camp', 'conference', 'meetup', 'webinar'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['workshop', 'hackathon', 'seminar', 'camp', 'conference', 'meetup', 'webinar'])
  type: string;

  @ApiProperty({ example: '107.1825', description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: '10.9567', description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ example: 'DNTU, Biên Hòa, Đồng Nai', description: 'Event address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '2026-07-15T09:00:00+07:00', description: 'Event start date and time' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-07-15T17:00:00+07:00', description: 'Event end date and time' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiProperty({ example: 50, description: 'Maximum number of participants' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg', description: 'Event banner image URL' })
  @IsOptional()
  @IsString()
  banner_url?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether event is online' })
  @IsOptional()
  @IsBoolean()
  is_online?: boolean;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij', description: 'Online meeting URL' })
  @IsOptional()
  @IsString()
  meeting_url?: string;

  @ApiPropertyOptional({ example: 100000, description: 'Event ticket price in VND (0 for free)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: ['react', 'javascript', 'frontend'], description: 'Event tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class RegisterEventDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID registering for event' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiPropertyOptional({ example: 'Tôi rất quan tâm đến workshop này', description: 'Registration notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
