import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('learning_materials')
export class LearningMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string; 

  @Column({ type: 'varchar', length: 100, nullable: true })
  subject: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grade: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  file_url: string;

  @Column({ type: 'bigint', nullable: true })
  file_size: number;

  @Column({ type: 'text', nullable: true })
  thumbnail_url: string;

  @Column({ default: 0 })
  download_count: number;

  @Column({ default: 0 })
  view_count: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  author_id: string;

  @Column({ default: false })
  is_offline_available: boolean;

  @Column({ type: 'text', nullable: true })
  search_vector: string;

  @CreateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  updated_at: Date;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  deleted_at: Date;
}
