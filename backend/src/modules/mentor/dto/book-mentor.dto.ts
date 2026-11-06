import { IsString, IsNotEmpty, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
export class BookingSlotDto {
    @IsDateString()
    start: string;
    @IsDateString()
    end: string;
}
export class BookMentorDto {
    @IsString()
    @IsNotEmpty()
    mentorId: string;
    @ValidateNested()
    @Type(() => BookingSlotDto)
    slot: BookingSlotDto;
}
