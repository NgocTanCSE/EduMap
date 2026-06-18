import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ example: 'user', description: 'Role of the message sender' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ example: 'Xin chào, tôi cần tư vấn về nghề nghiệp', description: 'Content of the message' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateChatDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'Tôi muốn biết về nghề AI Engineer', description: 'User message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ type: [ChatMessageDto], description: 'Chat history for context' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

export class LearningPathDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'beginner', description: 'Current skill level' })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiProperty({ example: 'AI Engineer', description: 'Target career/role' })
  @IsString()
  @IsNotEmpty()
  target_role: string;

  @ApiProperty({ example: '10', description: 'Hours per week available for learning' })
  @IsString()
  @IsNotEmpty()
  weekly_hours: string;
}

export class CareerQuizDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: ['problem-solving', 'creative', 'analytical'], description: 'Quiz answers' })
  @IsArray()
  @IsNotEmpty()
  answers: string[];
}

export class CareerRecommendDto {
  @ApiProperty({ example: 'user-uuid-123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: 'INTJ', description: 'MBTI personality type' })
  @IsOptional()
  @IsString()
  mbti_type?: string;

  @ApiProperty({ example: ['Python', 'Machine Learning'], description: 'User skills' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ example: 'AI Engineer', description: 'Career aspiration' })
  @IsOptional()
  @IsString()
  aspiration?: string;

  @ApiProperty({ example: 'Investigative', description: 'Holland code' })
  @IsOptional()
  @IsString()
  holland_code?: string;
}
