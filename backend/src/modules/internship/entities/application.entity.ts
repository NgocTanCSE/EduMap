import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Internship } from './internship.entity';

@Entity('internship_applications')
@Index(['user_id', 'internship_id'], { unique: true }) // Prevent duplicate applications
export class InternshipApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => Internship)
  @JoinColumn({ name: 'internship_id' })
  internship: Internship;

  @Column()
  internship_id: string;

  @Column({ type: 'text', nullable: true })
  cover_letter: string;

  @Column({ default: 'reviewing' }) // reviewing, accepted, rejected
  status: string;

  @Column({ unique: true })
  tracking_id: string;

  @CreateDateColumn()
  created_at: Date;
}
