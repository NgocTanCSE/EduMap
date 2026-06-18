import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OverviewQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date for overview' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date for overview' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ example: 'user-uuid-123', description: 'User ID (for admin viewing specific user)' })
  @IsOptional()
  @IsString()
  user_id?: string;
}
