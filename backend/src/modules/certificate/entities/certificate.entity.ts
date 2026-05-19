import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column()
  type: string; // workshop, volunteer, course, badge

  @Column()
  title: string;

  @Column({ type: 'timestamp with time zone' })
  issued_at: Date;

  @Column()
  issuer: string;

  @Index({ unique: true })
  @Column({ unique: true })
  verify_code: string;

  @Column({ nullable: true })
  qr_url: string;

  @Column({ nullable: true })
  pdf_url: string;

  @Column({ type: 'jsonb', nullable: true })
  blockchain_metadata: any; // Lưu hash giao dịch blockchain nếu tích hợp

  @CreateDateColumn()
  created_at: Date;
}
