// MentorSession entity representing a completed or ongoing mentoring session
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Mentor } from './mentor.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('mentor_sessions')
export class MentorSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Mentor)
  @JoinColumn({ name: 'mentor_id' })
  mentor: Mentor;

  @Column()
  mentor_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column({ type: 'timestamp' })
  slot_start: Date;

  @Column({ type: 'timestamp' })
  slot_end: Date;

  @Column({ default: 'pending' })
  status: string; // pending/confirmed/completed/cancelled

  @Column({ nullable: true })
  meeting_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
