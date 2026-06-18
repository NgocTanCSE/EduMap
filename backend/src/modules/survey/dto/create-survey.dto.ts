import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString, IsObject, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSurveyDto {
  @ApiProperty({ example: 'Khảo sát hài lòng sinh viên', description: 'Survey title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Khảo sát đánh giá mức độ hài lòng của sinh viên với dịch vụ nhà trường', description: 'Survey description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: [{ id: 'q1', type: 'rating', question: 'Bạn hài lòng với chất lượng giảng dạy?', options: ['1', '2', '3', '4', '5'] }], description: 'Survey questions in JSON format' })
  @IsObject()
  @IsNotEmpty()
  questions_json: Record<string, any>;

  @ApiProperty({ example: '2026-07-01', description: 'Survey start date' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-07-31', description: 'Survey end date' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({ example: ['student', 'teacher'], description: 'Target roles for the survey' })
  @IsOptional()
  @IsArray()
  target_roles?: string[];
}

export class SubmitSurveyDto {
  @ApiProperty({ example: { q1: '5', q2: 'Rất hài lòng', q3: '4' }, description: 'Survey answers in JSON format' })
  @IsObject()
  @IsNotEmpty()
  answers_json: Record<string, any>;
}
