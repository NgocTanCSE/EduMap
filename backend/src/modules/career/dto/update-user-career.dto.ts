import { PartialType } from '@nestjs/swagger';
import { CreateUserCareerDto } from './create-user-career.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserCareerStatus } from '../entities/user-career.entity';

export class UpdateUserCareerDto extends PartialType(CreateUserCareerDto) {
  @ApiProperty({ description: 'Trạng thái của mục tiêu nghề nghiệp', enum: UserCareerStatus, required: false })
  @IsOptional()
  @IsEnum(UserCareerStatus)
  status?: UserCareerStatus;
}
