import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Mentor } from './mentor.entity';

@Entity('mentor_availabilities')
export class MentorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Mentor)
  @JoinColumn({ name: 'mentor_id' })
  mentor: Mentor;

  @Column()
  mentor_id: string;

  @Column({ type: 'int' })
  day_of_week: number; // 0-6 (Sunday-Saturday)

  @Column({ type: 'time' })
  start_time: string; // HH:mm

  @Column({ type: 'time' })
  end_time: string; // HH:mm

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
