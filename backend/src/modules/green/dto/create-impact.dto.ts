import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGreenImpactDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'challenge-uuid-123', description: 'Challenge ID (optional)' })
  @IsOptional()
  @IsString()
  challenge_id?: string;

  @ApiProperty({ example: 'Tôi đã thu gom 5kg giấy tái chế tại khu phố', description: 'Activity description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/proof.jpg', description: 'Proof image URL' })
  @IsOptional()
  @IsString()
  proof_url?: string;

  @ApiPropertyOptional({ example: 2.5, description: 'Carbon saved in kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbon_saved_kg?: number;

  @ApiPropertyOptional({ example: 50, description: 'Points earned' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points_earned?: number;
}

export class CreateGreenChallengeDto {
  @ApiProperty({ example: 'Thu gom giấy tái chế', description: 'Challenge title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Thử thach thu gom và tái chế giấy trong 1 tuần', description: 'Challenge description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'recycle', description: 'Challenge type', enum: ['recycle', 'plant', 'save', 'educate', 'community', 'other'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '2026-07-01', description: 'Challenge start date' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-07-07', description: 'Challenge end date' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiProperty({ example: 100, description: 'Points reward for completion' })
  @IsNumber()
  @Min(1)
  points_reward: number;
}
