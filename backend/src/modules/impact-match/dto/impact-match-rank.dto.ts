import { IsOptional, IsString, IsNumber, IsArray, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Yêu cầu xếp hạng (rank) cho cặp đôi need ↔ sponsor.
 *
 * Frontend gửi bộ lọc tùy chọn; backend sẽ pre-filter ở mức SQLite rồi
 * mới gửi danh sách đã lọc sang ai-service để LLM xếp hạng.
 */
export class ImpactMatchRankDto {
  @ApiPropertyOptional({ example: 'Bình Dương', description: 'Lọc theo khu vực (LIKE trên cột location)' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'education_equipment', description: 'Lọc theo danh mục nhu cầu' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 15, description: 'Số cặp đôi tối đa gửi vào LLM (hard cap tránh tràn token)', minimum: 1, maximum: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  max_results?: number;

  @ApiPropertyOptional({ example: 200000000, description: 'Chi phí tối đa của nhu cầu để lọc' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_cost?: number;
}
