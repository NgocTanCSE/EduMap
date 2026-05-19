import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('analytics_logs')
export class AnalyticsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column()
  event_type: string; // e.g., 'view_material', 'search_keyword', 'click_roadmap'

  @Column('jsonb', { nullable: true })
  metadata: any; // Luu chi tiet nhu keyword, material_id...

  @CreateDateColumn()
  created_at: Date;
}
