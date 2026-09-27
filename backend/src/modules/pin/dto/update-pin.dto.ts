import { PartialType } from '@nestjs/swagger';
import { CreatePinDto } from './create-pin.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PinStatus } from '../entities/pin.entity';

export class UpdatePinDto extends PartialType(CreatePinDto) {
  // Chủ yếu dùng cho admin duyệt / từ chối pin
  @IsEnum(PinStatus)
  @IsOptional()
  status?: PinStatus;
}
