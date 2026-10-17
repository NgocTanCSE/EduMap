import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { CertificateTemplate } from './certificate-template.entity';

export enum CertificateStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

@Entity('user_certificates')
export class UserCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => CertificateTemplate)
  @JoinColumn({ name: 'template_id' })
  template: CertificateTemplate;

  @Column()
  template_id: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  issued_at: Date;

  @Index({ unique: true })
  @Column({ unique: true })
  verify_code: string;

  @Column({ nullable: true })
  qr_url: string;

  @Column({ nullable: true })
  pdf_url: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  blockchain_metadata: any; 

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'enum' : 'text', enum: CertificateStatus, default: CertificateStatus.ACTIVE })
  status: CertificateStatus;

  @CreateDateColumn()
  created_at: Date;
}
