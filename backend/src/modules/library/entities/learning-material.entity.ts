import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('learning_materials')
export class LearningMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  type: string; // Ebook, Video, Podcast, Document

  @Column()
  category: string; // Programming, Soft Skills, etc.

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  // ?? STORAGE: Thong tin file luu tren MinIO
  @Column({ nullable: true })
  file_url: string;

  @Column({ nullable: true })
  file_name: string;

  @Column({ nullable: true })
  mime_type: string;

  @Column({ default: 0 })
  view_count: number;

  @Column({ default: 0 })
  download_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
