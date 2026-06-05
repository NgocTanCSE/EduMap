import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SkillProficiency } from '../entities/user-skill.entity';

export class CreateUserSkillDto {
  @ApiProperty({ description: 'Tên kỹ năng (ví dụ: "JavaScript", "Project Management")' })
  @IsString()
  @IsNotEmpty()
  skill_name: string;

  @ApiProperty({ description: 'Cấp độ thành thạo', enum: SkillProficiency, default: SkillProficiency.BEGINNER })
  @IsEnum(SkillProficiency)
  @IsOptional()
  proficiency_level?: SkillProficiency;

  @ApiProperty({ description: 'Mô tả chi tiết về kỹ năng hoặc kinh nghiệm sử dụng', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
