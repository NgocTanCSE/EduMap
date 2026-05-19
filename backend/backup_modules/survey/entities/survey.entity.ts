import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../auth/entities/user.entity';

@Entity('surveys')
export class Survey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  questions_json: any;

  @ManyToOne(() => User)
  created_by: User;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
