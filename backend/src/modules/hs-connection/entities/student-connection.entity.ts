import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('student_connections')
@Index(['requester_id', 'receiver_id'], { unique: true })
export class StudentConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column()
  requester_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column()
  receiver_id: string;

  @Column({ default: 'pending' })
  status: string; // pending, accepted, rejected

  @CreateDateColumn()
  created_at: Date;
}
