import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSummerCampaignDto {
  @ApiProperty({ example: 'Mùa hè xanh 2026', description: 'Campaign title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Chiến dịch tình nguyện mùa hè dành cho sinh viên', description: 'Campaign description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-06-01', description: 'Campaign start date' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-08-31', description: 'Campaign end date' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({ example: 100, description: 'Maximum volunteers' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_volunteers?: number;

  @ApiPropertyOptional({ example: ['https://example.com/banner.jpg'], description: 'Campaign images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class LogActivityDto {
  @ApiProperty({ example: 'Dọn dẹp bãi biển', description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Tham gia dọn dẹp bãi biển Biên Hòa', description: 'Activity description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 8, description: 'Hours spent on activity' })
  @IsNumber()
  @Min(1)
  hours: number;

  @ApiProperty({ example: '2026-07-15', description: 'Activity date' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: ['https://example.com/proof.jpg'], description: 'Proof URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proof_urls?: string[];
}
