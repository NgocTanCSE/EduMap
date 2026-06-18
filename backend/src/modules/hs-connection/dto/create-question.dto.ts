import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ example: 'Làm thế nào để apply vào DNTU?', description: 'Question title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Em là học sinh lớp 12, em muốn biết quy trình nộp hồ sơ vào DNTU', description: 'Question content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: ['admission', 'dntu'], description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ConnectDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID to connect with' })
  @IsString()
  @IsNotEmpty()
  target_user_id: string;

  @ApiPropertyOptional({ example: 'Em muốn được tư vấn thêm về ngành IT', description: 'Connection message' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CampusTourDto {
  @ApiProperty({ example: 'DNTU', description: 'University name' })
  @IsString()
  @IsNotEmpty()
  university: string;

  @ApiProperty({ example: '2026-07-15T09:00:00+07:00', description: 'Preferred tour date' })
  @IsString()
  @IsNotEmpty()
  preferred_date: string;

  @ApiPropertyOptional({ example: 'Em muốn tham quan phòng lab và thư viện', description: 'Tour notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
