import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../../auth/entities/user.entity';
import { CareerPath } from './career.entity';

export enum UserCareerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
}

@Entity('user_careers')
export class UserCareer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => CareerPath, careerPath => careerPath.id, { nullable: true })
  @JoinColumn({ name: 'career_path_id' })
  career_path: CareerPath;

  @Column({ nullable: true })
  career_path_id: string;

  @Column()
  goal_title: string; // e.g., "Become a Senior Software Engineer"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  target_date: Date;

  @Column({ type: 'enum', enum: UserCareerStatus, default: UserCareerStatus.ACTIVE })
  status: UserCareerStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
