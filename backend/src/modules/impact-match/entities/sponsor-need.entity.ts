import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';
export enum NeedUrgency {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}
export enum NeedStatus {
    OPEN = 'open',
    MATCHED = 'matched',
    CLOSED = 'closed'
}
@Entity('sponsor_needs')
export class SponsorNeed {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ length: 255 })
    title: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ length: 100 })
    category: string;
    @Column({ ...enumColumn(), enum: NeedUrgency, default: NeedUrgency.MEDIUM })
    urgency: NeedUrgency;
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    cost_estimate: number;
    @Column({ length: 255, nullable: true })
    location: string;
    @Column({ ...enumColumn(), enum: NeedStatus, default: NeedStatus.OPEN })
    status: NeedStatus;
    @Column(textArrayColumn())
    tags: string[];
    @Column({ nullable: true })
    apply_url: string;
    @Column({ type: 'text', nullable: true })
    provenance: string;
    @Column({ nullable: true })
    created_by: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
    @DeleteDateColumn()
    deleted_at: Date;
}
