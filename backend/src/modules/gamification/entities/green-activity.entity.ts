import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('green_activities')
export class GreenActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column()
  activity_type: string; // planting, cleanup, recycling, energy_saving

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  proof_url: string;

  @Column({ default: 'pending' }) // pending, approved, rejected, flagged
  status: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  ai_confidence: number;

  @Column({ nullable: true })
  moderator_note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
