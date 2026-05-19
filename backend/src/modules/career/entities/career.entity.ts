import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('career_paths')
export class CareerPath {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  field: string; // IT, Marketing, etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  skills_required: string[];

  @Column({ type: 'jsonb', nullable: true })
  roadmap_json: any;

  @Column({ nullable: true })
  salary_range: string;

  @Column({ nullable: true })
  demand_level: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
