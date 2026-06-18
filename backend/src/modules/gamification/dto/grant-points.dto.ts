import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrantPointsDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID to grant points to' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 50, description: 'Number of points to grant' })
  @IsNumber()
  @Min(1)
  points: number;

  @ApiProperty({ example: 'create_post', description: 'Action that earned the points' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ example: 'community', description: 'Source type/category' })
  @IsString()
  @IsNotEmpty()
  source_type: string;

  @ApiPropertyOptional({ example: 'post-uuid-123', description: 'Source entity ID' })
  @IsOptional()
  @IsString()
  source_id?: string;
}

export class GrantAchievementDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID to grant achievement to' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 1, description: 'Badge ID to grant' })
  @IsNumber()
  @Min(1)
  badge_id: number;
}
