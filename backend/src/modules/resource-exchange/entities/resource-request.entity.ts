import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, } from 'typeorm';
import { enumColumn, textArrayColumn } from '../../../common/utils/db-column.utils';
import { ResourceType } from './resource.entity';
export enum RequestUrgency {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}
export enum RequestStatus {
    OPEN = 'open',
    FILLED = 'filled',
    CLOSED = 'closed'
}
@Entity('resource_requests')
export class ResourceRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ ...enumColumn(), enum: ResourceType })
    need_type: ResourceType;
    @Column({ length: 255 })
    title: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ ...enumColumn(), enum: RequestUrgency, default: RequestUrgency.MEDIUM })
    urgency: RequestUrgency;
    @Column({ length: 255 })
    location: string;
    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lat: number;
    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lng: number;
    @Column({ type: 'text', nullable: true })
    deadline: string | null;
    @Column({ type: 'int', default: 0 })
    preferred_min_condition: number;
    @Column({ length: 255, nullable: true })
    contact_method: string;
    @Column({ ...enumColumn(), enum: RequestStatus, default: RequestStatus.OPEN })
    status: RequestStatus;
    @Column(textArrayColumn())
    tags: string[];
    @Column({ nullable: true })
    created_by: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
