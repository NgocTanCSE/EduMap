import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShareItemDto {
  @ApiProperty({ example: 'Sách Lập trình Python', description: 'Item name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'book', description: 'Item category', enum: ['book', 'equipment', 'notes', 'other'] })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['book', 'equipment', 'notes', 'other'])
  category: string;

  @ApiProperty({ example: 'Sách mới, còn nguyên vẹn, 300 trang', description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class RequestBorrowDto {
  @ApiProperty({ example: 'Tôi muốn mượn cuốn sách này trong 2 tuần', description: 'Borrow request message' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
