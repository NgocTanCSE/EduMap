import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'moderator', description: 'Role name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Content Moderator', description: 'Display name' })
  @IsOptional()
  @IsString()
  display_name?: string;

  @ApiPropertyOptional({ example: 'Can moderate posts and comments', description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 50, description: 'Role level (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  level: number;

  @ApiPropertyOptional({ example: false, description: 'Whether role is system-created' })
  @IsOptional()
  @IsBoolean()
  system_created?: boolean;
}
