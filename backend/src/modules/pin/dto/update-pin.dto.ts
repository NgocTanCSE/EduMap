import { PartialType } from '@nestjs/swagger';
import { CreatePinDto } from './create-pin.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PinStatus } from '../entities/pin.entity';
export class UpdatePinDto extends PartialType(CreatePinDto) {
    @IsEnum(PinStatus)
    @IsOptional()
    status?: PinStatus;
}
