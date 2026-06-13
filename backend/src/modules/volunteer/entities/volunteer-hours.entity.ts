// VolunteerHours entity representing logged volunteer hours per user
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('volunteer_hours')
export class VolunteerHours {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 0 })
  hours: number;

  @CreateDateColumn()
  created_at: Date;
}
