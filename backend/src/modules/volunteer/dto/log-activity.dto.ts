import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogVolunteerActivityDto {
  @ApiProperty({ example: 'Dạy kèm trẻ em vùng cao', description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Tham gia dạy kèm toán và tiếng Anh cho trẻ em tại xã Sơn Hà', description: 'Activity description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Chiến dịch Summer of Service', description: 'Campaign name' })
  @IsOptional()
  @IsString()
  campaign_name?: string;

  @ApiProperty({ example: 24, description: 'Number of volunteer hours' })
  @IsNumber()
  @Min(1)
  hours: number;

  @ApiProperty({ example: '2026-06-15', description: 'Activity date' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: ['https://example.com/proof1.jpg'], description: 'Proof image URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proof_urls?: string[];
}
