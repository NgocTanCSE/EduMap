import { IsString, IsNotEmpty, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Khung thời gian đặt lịch (ánh xạ docs Bảng 6.2 — STT 22: bookSession(userId, mentorId, slot))
 */
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
