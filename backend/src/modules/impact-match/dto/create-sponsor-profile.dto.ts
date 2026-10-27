import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEmail, IsUUID, Min, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SponsorStatus } from '../entities/sponsor-profile.entity';

export class CreateSponsorProfileDto {
  @ApiProperty({ example: 'Bộ Giáo dục và Đào tạo', description: 'Tên tổ chức tài trợ' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Bộ Giáo dục và Đào tạo - Bộ nhà nước...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['education', 'scholarship'], description: 'Lĩnh vực tài trợ' })
  @IsArray()
  @IsString({ each: true })
  focus_areas: string[];

  @ApiProperty({ example: 500000000, description: 'Ngân sách tối đa (VND)', minimum: 0 })
  @IsNumber()
  @Min(0)
  budget_amount: number;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  budget_currency?: string;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://moet.gov.vn' })
  @IsOptional()
  @IsString()
  website_url?: string;

  @ApiPropertyOptional({ example: 'contact@moet.gov.vn' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @ApiPropertyOptional({ example: SponsorStatus.ACTIVE, enum: SponsorStatus })
  @IsOptional()
  @IsString()
  status?: SponsorStatus;

  @ApiPropertyOptional({ example: 'c4a1b2d3-...' })
  @IsOptional()
  @IsUUID()
  created_by?: string;
}
