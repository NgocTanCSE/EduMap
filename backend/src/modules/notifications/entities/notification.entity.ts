import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data_json: any;

  @Column({ default: false })
  is_read: boolean;

  @Column({ nullable: true })
  channel: string; // push/email/in_app

  @CreateDateColumn()
  sent_at: Date;

  @Column({ nullable: true })
  read_at: Date;
}
