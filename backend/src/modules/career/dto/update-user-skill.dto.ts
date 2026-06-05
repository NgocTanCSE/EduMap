import { PartialType } from '@nestjs/swagger';
import { CreateUserSkillDto } from './create-user-skill.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SkillProficiency } from '../entities/user-skill.entity';

export class UpdateUserSkillDto extends PartialType(CreateUserSkillDto) {
  @ApiProperty({ description: 'Cấp độ thành thạo', enum: SkillProficiency, required: false })
  @IsOptional()
  @IsEnum(SkillProficiency)
  proficiency_level?: SkillProficiency;
}
