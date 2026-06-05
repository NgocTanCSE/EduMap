import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserCareerStatus } from '../entities/user-career.entity';

export class CreateUserCareerDto {
  @ApiProperty({ description: 'Tiêu đề mục tiêu nghề nghiệp (ví dụ: "Trở thành Senior Software Engineer")' })
  @IsString()
  @IsNotEmpty()
  goal_title: string;

  @ApiProperty({ description: 'Mô tả chi tiết về mục tiêu nghề nghiệp', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Ngày mục tiêu hoàn thành (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  target_date?: Date;

  @ApiProperty({ description: 'Trạng thái của mục tiêu nghề nghiệp', enum: UserCareerStatus, default: UserCareerStatus.ACTIVE })
  @IsEnum(UserCareerStatus)
  @IsOptional()
  status?: UserCareerStatus;

  @ApiProperty({ description: 'ID của lộ trình nghề nghiệp liên quan', required: false })
  @IsOptional()
  @IsString()
  career_path_id?: string;
}
