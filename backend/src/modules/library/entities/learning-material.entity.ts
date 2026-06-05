import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MaterialType {
  EBOOK = 'ebook',
  VIDEO = 'video',
  PODCAST = 'podcast',
  DOCUMENT = 'document',
}

@Entity('learning_materials')
export class LearningMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  author: string; // Tác giả hoặc nguồn

  @Column({ type: 'enum', enum: MaterialType, default: MaterialType.DOCUMENT })
  type: MaterialType; 

  @Column({ nullable: true })
  category: string; // Lĩnh vực (VD: Programming, Soft Skills)

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  cover_image_url: string; // Ảnh bìa sách/video

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
