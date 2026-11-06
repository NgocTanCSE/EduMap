import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';
export enum SponsorStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    INACTIVE = 'inactive'
}
@Entity('sponsor_profiles')
export class SponsorProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ length: 255 })
    name: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column(jsonColumn())
    focus_areas: string[];
    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    budget_amount: number;
    @Column({ length: 10, default: 'VND' })
    budget_currency: string;
    @Column({ length: 255, nullable: true })
    location: string;
    @Column({ nullable: true })
    website_url: string;
    @Column({ nullable: true })
    contact_email: string;
    @Column({ ...enumColumn(), enum: SponsorStatus, default: SponsorStatus.ACTIVE })
    status: SponsorStatus;
    @Column({ default: false })
    is_verified: boolean;
    @Column({ nullable: true })
    created_by: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
