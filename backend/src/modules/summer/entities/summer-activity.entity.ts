import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { SummerCampaign } from './summer.entity';

@Entity('summer_activities')
export class SummerActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SummerCampaign)
  @JoinColumn({ name: 'campaign_id' })
  campaign: SummerCampaign;

  @Column()
  campaign_id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  volunteer_count: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  hours_spent: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ default: 'completed' })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
