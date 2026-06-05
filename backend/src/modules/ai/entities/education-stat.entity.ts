import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('education_stats')
export class EducationStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  region: string;

  @Column()
  province: string;

  @Column()
  metric_type: string; // literacy_rate, school_count, etc.

  @Column({ type: 'float' })
  value: number;

  @Column()
  year: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
