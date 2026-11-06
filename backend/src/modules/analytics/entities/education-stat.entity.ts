import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
@Entity('education_stats')
@Index(['region', 'province', 'year'])
export class EducationStat {
    @PrimaryGeneratedColumn()
    id: number;
    @Column({ nullable: true })
    region: string;
    @Column({ nullable: true })
    province: string;
    @Column({ nullable: true })
    district: string;
    @Column({ name: 'metric_type', nullable: true })
    metricType: string;
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
