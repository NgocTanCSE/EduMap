import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('mentors')
export class Mentor {
  @PrimaryColumn('uuid')
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'jsonb', nullable: true })
  specialties: string[];

  @Column({ default: 0 })
  experience_years: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  hourly_rate: number;

  @Column({ default: false })
  is_verified: boolean;
}

@Entity('bookings')
export class Booking {
  @PrimaryColumn('uuid')
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

  @Column({ type: 'timestamp with time zone' })
  slot_start: Date;

  @Column({ type: 'timestamp with time zone' })
  slot_end: Date;

  @Column({ default: 'pending' })
  status: string; // pending/confirmed/completed/cancelled

  @Column({ nullable: true })
  meeting_url: string;
}
