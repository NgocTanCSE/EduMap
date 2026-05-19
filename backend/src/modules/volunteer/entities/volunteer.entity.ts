import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('volunteer_activities')
export class VolunteerActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  campaign_name: string;

  @Column({ default: 0 })
  hours: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 'pending' })
  status: string; // pending/verified

  @ManyToOne(() => User)
  @JoinColumn({ name: 'volunteer_id' })
  volunteer: User;

  @Column()
  volunteer_id: string;

  @CreateDateColumn()
  created_at: Date;
}
