import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Xây thư viện cho trẻ em vùng cao', description: 'Campaign title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Chiến dịch xây thư viện cho trẻ em tại xã vùng cao tỉnh Hà Giang', description: 'Campaign description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 100000000, description: 'Target donation amount in VND' })
  @IsNumber()
  @Min(100000)
  target_amount: number;

  @ApiProperty({ example: '2026-01-01', description: 'Campaign start date' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-06-30', description: 'Campaign end date' })
  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({ example: '107.1825', description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: '10.9567', description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: ['https://example.com/image1.jpg'], description: 'Campaign images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class DonateDto {
  @ApiProperty({ example: 500000, description: 'Donation amount in VND' })
  @IsNumber()
  @Min(10000)
  amount: number;

  @ApiPropertyOptional({ example: 'VND', description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'bank_transfer', description: 'Payment method', enum: ['bank_transfer', 'credit_card', 'e_wallet', 'cash', 'other'] })
  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @ApiPropertyOptional({ example: true, description: 'Whether donation is anonymous' })
  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @ApiPropertyOptional({ example: 'Chúc chiến dịch thành công!', description: 'Donation message' })
  @IsOptional()
  @IsString()
  message?: string;
}
