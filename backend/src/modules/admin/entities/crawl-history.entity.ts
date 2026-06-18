import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('crawl_history')
export class CrawlHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'crawl_type', length: 50 })
  crawlType: string;

  @Column({ name: 'status', length: 50 })
  status: string;

  @Column({ name: 'records_added', default: 0 })
  recordsAdded: number;

  @Column({ name: 'records_updated', default: 0 })
  recordsUpdated: number;

  @Column({ name: 'records_deleted', default: 0 })
  recordsDeleted: number;

  @Column({ name: 'errors', default: 0 })
  errors: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds: number;

  @Column({ name: 'triggered_by', nullable: true })
  triggeredBy: string;

  @Column({ name: 'is_automatic', default: false })
  isAutomatic: boolean;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
}
