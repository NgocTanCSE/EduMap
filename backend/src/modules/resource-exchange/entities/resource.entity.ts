import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, } from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';
export enum ResourceType {
    BOOK = 'book',
    DEVICE = 'device',
    VOLUNTEER_HOURS = 'volunteer_hours'
}
export enum ResourceStatus {
    AVAILABLE = 'available',
    RESERVED = 'reserved',
    UNAVAILABLE = 'unavailable'
}
@Entity('resources')
export class Resource {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ ...enumColumn(), enum: ResourceType })
    type: ResourceType;
    @Column({ length: 255 })
    title: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ type: 'int', default: 5 })
    condition: number;
    @Column({ length: 255 })
    location: string;
    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lat: number;
    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lng: number;
    @Column({ type: 'text', nullable: true, default: null })
    available_from: string | null;
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    cost: number;
    @Column({ length: 255, nullable: true })
    contact_method: string;
    @Column({ ...enumColumn(), enum: ResourceStatus, default: ResourceStatus.AVAILABLE })
    status: ResourceStatus;
    @Column({ default: false })
    is_verified: boolean;
    @Column(textArrayColumn())
    tags: string[];
    @Column(jsonColumn(true))
    metadata: Record<string, any>;
    @Column({ nullable: true })
    created_by: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
