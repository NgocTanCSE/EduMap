import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterTeamDto {
  @ApiProperty({ example: 'hackathon-uuid-123', description: 'Hackathon ID' })
  @IsString()
  @IsNotEmpty()
  hackathon_id: string;

  @ApiProperty({ example: 'AI Innovators', description: 'Team name' })
  @IsString()
  @IsNotEmpty()
  team_name: string;

  @ApiProperty({ example: ['user-uuid-1', 'user-uuid-2'], description: 'Team member user IDs' })
  @IsArray()
  @IsString({ each: true })
  member_ids: string[];

  @ApiPropertyOptional({ example: 'Dự án sử dụng AI để giải quyết vấn đề giáo dục', description: 'Project idea description' })
  @IsOptional()
  @IsString()
  project_idea?: string;
}

export class SubmitProjectDto {
  @ApiProperty({ example: 'https://github.com/team/project', description: 'GitHub repository URL' })
  @IsString()
  @IsNotEmpty()
  repo_url: string;

  @ApiProperty({ example: 'https://demo.example.com', description: 'Demo URL' })
  @IsString()
  @IsNotEmpty()
  demo_url: string;

  @ApiProperty({ example: 'AI-powered education platform', description: 'Project title' })
  @IsString()
  @IsNotEmpty()
  project_title: string;

  @ApiPropertyOptional({ example: 'Mô tả chi tiết dự án...', description: 'Project description' })
  @IsOptional()
  @IsString()
  project_description?: string;
}

export class JudgeProjectDto {
  @ApiProperty({ example: 'team-uuid-123', description: 'Team ID' })
  @IsString()
  @IsNotEmpty()
  team_id: string;

  @ApiProperty({ example: 8.5, description: 'Score (0-10)' })
  @IsString()
  @IsNotEmpty()
  score: string;

  @ApiPropertyOptional({ example: 'Dự án rất sáng tạo và có tính ứng dụng cao', description: 'Judge comments' })
  @IsOptional()
  @IsString()
  comments?: string;
}
