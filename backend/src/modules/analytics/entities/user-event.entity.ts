import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_events')
export class UserEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'event_type' })
  eventType: string; // e.g., 'page_view', 'click_career', 'search_scholarship'

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional info like { page: '/map', duration: 30 }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
