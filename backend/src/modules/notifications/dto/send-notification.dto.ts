import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID to send notification to' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'Bạn có thông báo mới', description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Bạn đã nhận được 50 điểm thưởng', description: 'Notification body' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ example: 'in_app', description: 'Notification channel', enum: ['push', 'email', 'in_app', 'sms'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['push', 'email', 'in_app', 'sms'])
  channel: string;

  @ApiPropertyOptional({ example: { type: 'achievement', id: 'badge-123' }, description: 'Additional data' })
  @IsOptional()
  @IsObject()
  data_json?: Record<string, any>;
}

export class MarkNotificationReadDto {
  @ApiProperty({ example: 'notification-uuid-123', description: 'Notification ID to mark as read' })
  @IsString()
  @IsNotEmpty()
  notification_id: string;
}
