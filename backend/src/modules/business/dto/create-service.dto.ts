import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ description: 'Tên dịch vụ', example: 'Gia sư Toán 12' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mô tả dịch vụ', example: 'Gia sư luyện thi đại học môn Toán lớp 12.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Giá dịch vụ', example: 200000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsNotEmpty()
  price: number;

  @ApiProperty({ description: 'Đơn vị tiền tệ', example: 'VND' })
  @IsString()
  @IsOptional()
  currency?: string = 'VND';

  @ApiProperty({ description: 'Danh mục dịch vụ', example: 'Gia sư' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Thời lượng dịch vụ', example: '2 giờ/buổi' })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiProperty({ description: 'Địa điểm dịch vụ', example: 'Online' })
  @IsString()
  @IsOptional()
  location?: string;
}
