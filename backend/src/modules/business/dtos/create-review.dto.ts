import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Đánh giá (1-5 sao)', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiProperty({ description: 'Nội dung đánh giá', example: 'Chất lượng rất tốt!' })
  @IsString()
  @IsOptional()
  comment?: string;
}
