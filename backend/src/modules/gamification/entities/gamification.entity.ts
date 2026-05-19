import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
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

  @Column({ nullable: true })
  action: string;

  @Column({ nullable: true })
  source_type: string;

  @CreateDateColumn()
  created_at: Date;
}
