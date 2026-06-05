import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { SummerCampaign } from './summer.entity';

@Entity('summer_registrations')
@Index(['user_id', 'campaign_id'], { unique: true }) // Prevent duplicate registrations
export class SummerRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => SummerCampaign)
  @JoinColumn({ name: 'campaign_id' })
  campaign: SummerCampaign;

  @Column()
  campaign_id: string;

  @Column({ default: 'pending' }) // pending, approved, rejected
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
