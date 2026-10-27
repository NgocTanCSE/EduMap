import { IsNumber, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query params for GET /learning-spots/recommend.
 * Validates user-supplied filter and weight overrides.
 */
export class RecommendSpotsDto {
  @ApiProperty({ example: 10.7727, description: 'User latitude' })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 106.6538, description: 'User longitude' })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 5000, description: 'Search radius in meters (default 5000)' })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50000)
  radius?: number;

  @ApiPropertyOptional({ example: true, description: 'Filter: must have WiFi' })
  @IsOptional()
  @IsBoolean()
  has_wifi?: boolean;

  @ApiPropertyOptional({ example: 4, description: 'Minimum rating (0–5)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;

  @ApiPropertyOptional({ example: 4, description: 'Minimum quietness level (1–5)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  quietness_min?: number;

  @ApiPropertyOptional({ example: true, description: 'Filter: only spots open now' })
  @IsOptional()
  @IsBoolean()
  open_now?: boolean;

  @ApiPropertyOptional({ example: 20, description: 'Max results (default 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // ── Weight overrides (each 0–1; auto-normalised so they sum to 1) ──
  @ApiPropertyOptional({ example: 0.4, description: 'Weight for distance criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_distance?: number;

  @ApiPropertyOptional({ example: 0.2, description: 'Weight for rating criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_rating?: number;

  @ApiPropertyOptional({ example: 0.1, description: 'Weight for Wi-Fi criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_wifi?: number;

  @ApiPropertyOptional({ example: 0.15, description: 'Weight for quietness criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_quietness?: number;

  @ApiPropertyOptional({ example: 0.1, description: 'Weight for open-now criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_open_now?: number;

  @ApiPropertyOptional({ example: 0.05, description: 'Weight for capacity criterion' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  w_capacity?: number;
}
