import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookmarkTargetType } from '../entities/bookmark.entity';

export class CreateBookmarkDto {
  @ApiProperty({
    enum: BookmarkTargetType,
    example: BookmarkTargetType.INTERNSHIPS,
    description: 'Loại nội dung được lưu (internships | scholarships)',
  })
  @IsEnum(BookmarkTargetType)
  @IsNotEmpty()
  target_type: BookmarkTargetType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID của nội dung được lưu',
  })
  @IsString()
  @IsNotEmpty()
  target_id: string;
}
