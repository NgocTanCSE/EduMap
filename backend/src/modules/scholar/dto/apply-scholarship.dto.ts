import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class ApplyScholarshipDto {
  @IsString()
  @IsNotEmpty()
  personal_statement: string;

  @IsString()
  @IsNotEmpty()
  cv_url: string;
}
