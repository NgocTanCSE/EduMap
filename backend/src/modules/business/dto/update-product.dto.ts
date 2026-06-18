import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDecimal, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  // All fields are optional because PartialType makes them so.
  // We can add specific update-only validations here if needed.
}
