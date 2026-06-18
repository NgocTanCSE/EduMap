import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ name: 'data_json', type: 'jsonb', nullable: true })
  data: any;

  @Column({ default: false })
  is_read: boolean;

  @Column({ nullable: true })
  channel: string;

  @CreateDateColumn()
  sent_at: Date;

  @Column({ nullable: true })
  read_at: Date;
}
