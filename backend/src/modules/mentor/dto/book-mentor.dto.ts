import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class BookMentorDto {
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @IsDateString()
  @IsNotEmpty()
  slotStart: string;

  @IsDateString()
  @IsNotEmpty()
  slotEnd: string;
}
