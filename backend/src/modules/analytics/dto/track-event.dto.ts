import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrackEventDto {
  @ApiProperty({ example: 'page_view', description: 'Event type' })
  @IsString()
  @IsNotEmpty()
  event_type: string;

  @ApiPropertyOptional({ example: '/dashboard', description: 'Page URL' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: 120, description: 'Duration in seconds' })
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ example: 'desktop', description: 'Device type' })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({ example: { custom_field: 'value' }, description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class StatsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date for query' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date for query' })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({ example: 'page_view', description: 'Filter by event type' })
  @IsOptional()
  @IsString()
  event_type?: string;
}
