import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_files')
export class UserFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column()
  original_name: string;

  @Column()
  file_url: string;

  @Column()
  mime_type: string;

  @Column('float')
  size_kb: number;

  @CreateDateColumn()
  created_at: Date;
}
