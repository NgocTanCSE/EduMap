import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'Ngôn ngữ', example: 'vi', required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ description: 'Giao diện (dark/light)', example: 'dark', required: false })
  @IsString()
  @IsOptional()
  @IsEnum(['dark', 'light'])
  theme?: string;

  @ApiProperty({ description: 'Bật/tắt thông báo', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  notifications_enabled?: boolean;

  @ApiProperty({ description: 'Mức độ riêng tư (public/private)', example: 'public', required: false })
  @IsString()
  @IsOptional()
  @IsEnum(['public', 'private'])
  privacy_level?: string;
}
