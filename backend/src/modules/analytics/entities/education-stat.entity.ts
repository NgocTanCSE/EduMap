import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('education_stats')
@Index(['region', 'province', 'year'])
export class EducationStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  region: string; // e.g., 'Đồng bằng sông Cửu Long'

  @Column()
  province: string; // e.g., 'Cần Thơ'

  @Column({ name: 'metric_type' })
  metricType: string; // e.g., 'STEM Lab Usage', 'Online Learning Adoption'

  @Column({ name: 'metric_value', type: 'decimal', precision: 10, scale: 2 })
  metricValue: number;

  @Column()
  year: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Extra data like { growth_rate: 0.05 }
}
