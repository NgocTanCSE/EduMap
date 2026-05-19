import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('donation_campaigns')
export class DonationCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  target_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  current_amount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  end_date: Date;

  @Column({ default: 'active' }) // active, completed, cancelled
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DonationCampaign)
  @JoinColumn({ name: 'campaign_id' })
  campaign: DonationCampaign;

  @Column()
  campaign_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'donor_id' })
  donor: User;

  @Column({ nullable: true })
  donor_id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ default: 'completed' }) // completed, pending, failed
  status: string;

  @Column({ nullable: true })
  transaction_id: string;

  @CreateDateColumn()
  created_at: Date;
}
