import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDecimal, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Tên sản phẩm', example: 'Khóa học lập trình web cơ bản' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mô tả sản phẩm', example: 'Khóa học dành cho người mới bắt đầu học lập trình web với HTML, CSS, JavaScript.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Giá sản phẩm', example: 500000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsNotEmpty()
  price: number;

  @ApiProperty({ description: 'Đơn vị tiền tệ', example: 'VND' })
  @IsString()
  @IsOptional()
  currency?: string = 'VND';

  @ApiProperty({ description: 'Danh mục sản phẩm', example: 'Khóa học online' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Số lượng trong kho', example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number = 0;

  @ApiProperty({ description: 'URL hình ảnh sản phẩm', example: 'https://example.com/image.jpg' })
  @IsString()
  @IsOptional()
  image_url?: string;
}
