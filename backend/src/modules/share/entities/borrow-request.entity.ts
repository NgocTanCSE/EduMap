import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { SharedItem } from './share.entity';

@Entity('borrow_requests')
export class BorrowRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SharedItem)
  @JoinColumn({ name: 'item_id' })
  item: SharedItem;

  @Column()
  item_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column()
  requester_id: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ default: 'pending' })
  status: string; // pending, approved, rejected, completed

  @CreateDateColumn()
  created_at: Date;
}
