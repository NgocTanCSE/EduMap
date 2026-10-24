import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Mirrors the `education_stats` table from backend/src/database/schema.sql.
 *
 * The previous definition used a UUID id and a `metadata` JSON column that do
 * not exist in either the PostgreSQL schema or the pre-seeded SQLite file, so
 * every `find()` / query-builder call failed with "no such column:
 * stat.metadata" on HF Spaces. Keep this entity in sync with the real schema.
 */
@Entity('education_stats')
@Index(['region', 'province', 'year'])
export class EducationStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  region: string; // e.g., 'Đồng Nai'

  @Column({ nullable: true })
  province: string; // e.g., 'Đồng Nai'

  @Column({ nullable: true })
  district: string;

  @Column({ name: 'metric_type', nullable: true })
  metricType: string; // e.g., 'Enrollment Rate', 'STEM Lab Usage'

  @Column({ name: 'metric_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  metricValue: number;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  source: string;

  @CreateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  created_at: Date;

  @UpdateDateColumn({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  updated_at: Date;
}
