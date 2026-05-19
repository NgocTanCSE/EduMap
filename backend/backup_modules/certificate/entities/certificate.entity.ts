import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../auth/entities/user.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  type: string; // workshop, volunteer, course, badge

  @Column()
  title: string;

  @Column({ type: 'timestamp' })
  issued_at: Date;

  @Column()
  issuer: string;

  @Column({ unique: true })
  verify_code: string;

  @Column({ nullable: true })
  qr_url: string;

  @Column({ nullable: true })
  pdf_url: string;

  @CreateDateColumn()
  created_at: Date;
}
