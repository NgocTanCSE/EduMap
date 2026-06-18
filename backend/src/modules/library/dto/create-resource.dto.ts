import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({ example: 'Lập trình Python cơ bản', description: 'Resource title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Cuốn sách hướng dẫn lập trình Python từ cơ bản đến nâng cao', description: 'Resource description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'ebook', description: 'Resource type', enum: ['video', 'pdf', 'course', 'ebook', 'article', 'tutorial', 'podcast'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['video', 'pdf', 'course', 'ebook', 'article', 'tutorial', 'podcast'])
  type: string;

  @ApiProperty({ example: 'Computer Science', description: 'Subject category' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ example: 'University', description: 'Grade level' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ example: ['python', 'programming', 'beginner'], description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'https://example.com/book.pdf', description: 'File URL' })
  @IsOptional()
  @IsString()
  file_url?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumbnail.jpg', description: 'Thumbnail URL' })
  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether resource is available offline' })
  @IsOptional()
  is_offline_available?: boolean;
}

export class SearchResourceDto {
  @ApiProperty({ example: 'python', description: 'Search query' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional({ example: 'ebook', description: 'Filter by type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'Computer Science', description: 'Filter by subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
