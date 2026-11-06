import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, } from 'typeorm';
import { enumColumn } from '../../../common/utils/db-column.utils';
export enum MatchStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
    COMPLETED = 'completed'
}
@Entity('resource_matches')
export class ResourceMatch {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ type: 'uuid' })
    resource_id: string;
    @Column({ type: 'uuid' })
    request_id: string;
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    match_score: number;
    @Column({ type: 'text', nullable: true })
    explanation: string;
    @Column({ ...enumColumn(), enum: MatchStatus, default: MatchStatus.PENDING })
    status: MatchStatus;
    @Column({ type: 'text', nullable: true })
    scheduled_pickup: string | null;
    @Column({ type: 'text', nullable: true })
    transport_plan: string | null;
    @Column({ nullable: true })
    created_by: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
