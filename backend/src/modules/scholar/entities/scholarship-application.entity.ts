import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Scholarship } from './scholarship.entity';

@Entity('scholarship_applications')
export class ScholarshipApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Scholarship)
  @JoinColumn({ name: 'scholarship_id' })
  scholarship: Scholarship;

  @Column()
  scholarship_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column({ type: 'text', nullable: true })
  personal_statement: string;

  @Column({ nullable: true })
  cv_url: string;

  @Column({ default: 'pending' })
  status: string; // pending, reviewed, accepted, rejected

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
