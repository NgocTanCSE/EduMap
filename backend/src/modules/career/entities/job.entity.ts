import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity'; // Assuming User entity path
import { CareerPath } from './career.entity'; // Assuming CareerPath entity path

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  INTERNSHIP = 'internship',
  FREELANCE = 'freelance',
  CONTRACT = 'contract',
  COURSE = 'course', // Added for course opportunities
}

export enum JobStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CLOSED = 'closed',
  PENDING = 'pending',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  company_name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'enum', enum: JobType, default: JobType.FULL_TIME })
  job_type: JobType;

  @Column({ nullable: true })
  salary_range: string;

  @Column({ type: 'jsonb', nullable: true })
  required_skills: string[];

  @Column({ nullable: true })
  experience_level: string;

  @Column({ nullable: true })
  application_deadline: Date;

  @Column({ default: 0 })
  views: number;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.ACTIVE })
  status: JobStatus;

  // Relation to User (the employer who posted the job)
  @ManyToOne(() => User, user => (user as any).id, { nullable: true })
  @JoinColumn({ name: 'posted_by_user_id' })
  posted_by: User;

  @Column({ nullable: true })
  posted_by_user_id: string;

  // Relation to CareerPath (if a job is aligned with a specific career path)
  @ManyToOne(() => CareerPath, careerPath => careerPath.id, { nullable: true })
  @JoinColumn({ name: 'career_path_id' })
  career_path: CareerPath;

  @Column({ nullable: true })
  career_path_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
