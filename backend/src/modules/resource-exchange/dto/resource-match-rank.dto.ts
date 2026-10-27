import { IsOptional, IsString, IsNumber, IsArray, IsUUID, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Yêu cầu matching — frontend gửi bộ lọc tùy chọn; backend sẽ pre-filter ở
 * mức SQLite rồi mới gửi danh sách đã lọc sang ai-service để LLM xếp hạng.
 */
export class ResourceMatchRankDto {
  @ApiPropertyOptional({
    example: 'Bình Dương',
    description: 'Lọc theo khu vực (LIKE trên cột location)',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ enum: ['book', 'device', 'volunteer_hours'], example: 'device' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Số cặp tối đa gửi vào LLM (hard cap tránh tràn token)',
    minimum: 1,
    maximum: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  max_results?: number;
}
