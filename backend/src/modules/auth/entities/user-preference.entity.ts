import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.preferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ default: 'vi' })
  language: string;

  @Column({ default: 'dark' })
  theme: string;

  @Column({ default: true })
  notifications_enabled: boolean;

  @Column({ default: 'public' })
  privacy_level: string; // public, private

  /** Cài đặt thông báo chi tiết (JSON string): {"push":true,"email":false,"community":true,"career":true} */
  @Column({ type: 'text', nullable: true })
  notification_settings: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
