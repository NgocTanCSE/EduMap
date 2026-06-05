import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../entities/job.entity';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiProperty({ description: 'Trạng thái của công việc (active, inactive, closed, pending)', enum: JobStatus, required: false })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
