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

  @CreateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  updated_at: Date;
}
