import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('green_challenges')
export class GreenChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 0 })
  points_reward: number;

  @Column({ default: 'active' })
  status: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column()
  created_by: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('green_challenge_activities')
export class GreenChallengeActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => GreenChallenge)
  @JoinColumn({ name: 'challenge_id' })
  challenge: GreenChallenge;

  @Column()
  challenge_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  carbon_saved_kg: number;

  @Column({ default: 0 })
  points_earned: number;

  @CreateDateColumn()
  created_at: Date;
}
