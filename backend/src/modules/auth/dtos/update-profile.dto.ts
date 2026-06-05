import { IsString, IsOptional, IsArray, IsUrl, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Họ và tên', example: 'Lê Ngọc Tân', required: false })
  @IsString()
  @IsOptional()
  full_name?: string;

  @ApiProperty({ description: 'URL ảnh đại diện', example: 'https://example.com/avatar.jpg', required: false })
  @IsUrl()
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0901234567', required: false })
  @IsString()
  @IsOptional()
  @Length(10, 15)
  phone?: string;

  @ApiProperty({ description: 'Tiểu sử', example: 'Sinh viên đam mê công nghệ và môi trường.', required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ description: 'Loại MBTI', example: 'INTJ', required: false })
  @IsString()
  @IsOptional()
  mbti_type?: string;

  @ApiProperty({ description: 'Danh sách kỹ năng', example: ['TypeScript', 'NestJS'], required: false })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiProperty({ description: 'Danh sách sở thích', example: ['Đọc sách', 'Chạy bộ'], required: false })
  @IsArray()
  @IsOptional()
  interests?: string[];
}
