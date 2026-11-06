import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { geoPointColumn, jsonColumn, textArrayColumn, datetimeColumn } from '../../../common/utils/db-column.utils';
@Entity('learning_spots')
@Index(['has_wifi', 'quietness'])
export class LearningSpot {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column()
    name: string;
    @Column(geoPointColumn())
    location: any;
    @Column({ nullable: true })
    type: string;
    @Column({ nullable: true })
    address: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ default: true })
    has_wifi: boolean;
    @Column({ default: true })
    has_power_outlets: boolean;
    @Column({ type: 'integer', nullable: true })
    quietness: number;
    @Column(jsonColumn(true))
    opening_hours: Record<string, string | null>;
    @Column(textArrayColumn())
    amenities: string[];
    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    rating_avg: number;
    @Column({ default: 50 })
    total_capacity: number;
    @CreateDateColumn()
    created_at: Date;
    @Column(datetimeColumn(true))
    last_updated: Date;
}
