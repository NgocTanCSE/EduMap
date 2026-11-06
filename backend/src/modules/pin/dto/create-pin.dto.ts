import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsArray } from 'class-validator';
import { PinType } from '../entities/pin.entity';
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
