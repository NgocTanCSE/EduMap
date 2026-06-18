import { IsString, IsNotEmpty, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueCertificateDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID to issue certificate to' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'workshop', description: 'Certificate type', enum: ['workshop', 'volunteer', 'course', 'achievement', 'completion', 'recognition'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'Chứng nhận hoàn thành Workshop React', description: 'Certificate title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Chứng nhận người dùng đã hoàn thành xuất sắc khóa học React từ cơ bản đến nâng cao', description: 'Certificate description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-06-15', description: 'Issue date' })
  @IsDateString()
  @IsNotEmpty()
  issued_at: string;

  @ApiProperty({ example: 'Đại học Công nghệ Đồng Nai', description: 'Certificate issuer' })
  @IsString()
  @IsNotEmpty()
  issuer: string;

  @ApiPropertyOptional({ example: { event_id: 'event-uuid-123', hours: 8 }, description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class VerifyCertificateDto {
  @ApiProperty({ example: 'CERT-ABC123', description: 'Verification code' })
  @IsString()
  @IsNotEmpty()
  verify_code: string;
}
