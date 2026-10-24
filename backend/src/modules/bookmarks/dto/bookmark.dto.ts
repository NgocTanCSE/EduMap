import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookmarkTargetType } from '../entities/bookmark.entity';

export class CreateBookmarkDto {
  @ApiProperty({
    enum: BookmarkTargetType,
    example: BookmarkTargetType.JOB,
    description:
      'Loại nội dung được đánh dấu (poi | internships | scholarships | job | event | opportunity | lab | community_post | marketplace_product | marketplace_service | shared_item | library_item | mentor | donate_campaign | green | wifi | summer | hackathon)',
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
