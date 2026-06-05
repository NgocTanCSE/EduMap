import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  icon_url: string;

  @Column({ nullable: true })
  category: string;

  @Column({ default: 0 })
  points_criteria: number;

  @Column({ default: 'common' })
  rarity: string;
}

@Entity('user_badges')
@Index(['user_id', 'badge_id'], { unique: true })
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => Badge)
  @JoinColumn({ name: 'badge_id' })
  badge: Badge;

  @Column()
  badge_id: number;

  @CreateDateColumn()
  earned_at: Date;
}

@Entity('user_points')
@Index(['user_id', 'action', 'reference_id'], { unique: true }) // Idempotency check
export class UserPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column()
  points: number;

  @Column()
  action: string; // Tên hành động hoặc mã (e.g., 'DONATE_CAMPAIGN_1')

  @Column({ nullable: true })
  reference_id: string; // ID của đối tượng liên quan (VD: ID của donation, event)

  @Column({ nullable: true })
  source_type: string;

  @CreateDateColumn()
  created_at: Date;
}
