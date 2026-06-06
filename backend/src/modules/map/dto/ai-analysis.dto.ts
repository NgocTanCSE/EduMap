import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiAnalysisDto {
  @ApiProperty({ description: 'The query or question for the AI to analyze regarding locations' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({ description: 'Optional context like current location or user preferences', required: false })
  @IsOptional()
  context?: any;
}
