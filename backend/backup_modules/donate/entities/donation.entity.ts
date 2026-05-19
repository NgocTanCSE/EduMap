import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { DonationCampaign } from './donation-campaign.entity';

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DonationCampaign)
  campaign: DonationCampaign;

  @ManyToOne(() => User)
  donor: User;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ default: 'completed' })
  status: string;

  @Column({ nullable: true })
  transaction_id: string;

  @CreateDateColumn()
  created_at: Date;
}
