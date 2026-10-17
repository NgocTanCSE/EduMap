import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum Model3DShape {
  CYLINDER = 'cylinder',
  PLANE = 'plane',
  SPHERE = 'sphere',
  BOX = 'box',
}

@Entity('model_3d')
export class Model3DEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  user_id: string;

  @Column()
  original_name: string;

  @Column()
  texture_url: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'enum' : 'text', enum: Model3DShape, default: Model3DShape.CYLINDER })
  shape: Model3DShape;

  @Column({ type: 'text', nullable: true })
  prompt: string;

  @Column({ type: 'int' })
  image_width: number;

  @Column({ type: 'int' })
  image_height: number;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json' })
  texture_params: any;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json' })
  geometry_params: any;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  light_params: any;

  @Column({ type: 'text', nullable: true })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
