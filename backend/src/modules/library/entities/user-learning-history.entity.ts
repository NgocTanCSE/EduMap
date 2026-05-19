import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { LearningMaterial } from './learning-material.entity';

@Entity('user_learning_history')
export class UserLearningHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @ManyToOne(() => LearningMaterial)
  @JoinColumn({ name: 'material_id' })
  material: LearningMaterial;

  @Column()
  material_id: string;

  @Column({ default: 0 })
  progress: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_accessed: Date;
}
