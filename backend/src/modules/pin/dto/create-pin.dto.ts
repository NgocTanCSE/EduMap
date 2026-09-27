import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsArray } from 'class-validator';
import { PinType } from '../entities/pin.entity';

/**
 * DTO tạo pin. Poster (`posted_by`/`poster_name`) được gán từ `req.user`
 * trong service — không chấp nhận từ client để tránh giả mạo tên người post.
 */
export class CreatePinDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(PinType)
  @IsOptional()
  type?: PinType = PinType.EVENT;

  /** GeoJSON Geometry: Point (chỗ nào có sự kiện) hoặc LineString (từ khu này đến khu kia). */
  @IsObject()
  @IsOptional()
  location?: any;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsArray()
  @IsOptional()
  tags?: string[];
}
