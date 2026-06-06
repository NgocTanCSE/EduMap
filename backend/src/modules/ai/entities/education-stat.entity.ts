import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('education_stats')
export class EducationStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  metric_type: string; // literacy_rate, school_count, etc.

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  metric_value: number;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  source: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
