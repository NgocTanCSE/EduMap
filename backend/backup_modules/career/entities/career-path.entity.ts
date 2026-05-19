import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('career_paths')
export class CareerPath {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  field: string; // IT, Marketing, etc.

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: '{}' })
  skills_required: string[];

  @Column({ type: 'jsonb' })
  roadmap_json: any;

  @Column({ nullable: true })
  salary_range: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
