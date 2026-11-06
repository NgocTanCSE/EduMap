import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index, } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
export enum PinType {
    EVENT = 'event',
    AD = 'ad',
    GREEN = 'green',
    BOOK = 'book',
    WIFI = 'wifi',
    NOTE = 'note',
    OTHER = 'other'
}
export enum PinStatus {
    PENDING = 'pending',
    PUBLISHED = 'published',
    REJECTED = 'rejected'
}
@Entity('pins')
@Index(['status', 'type'])
@Index(['posted_by'])
export class Pin {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    @Column({ type: 'text', nullable: true })
    content: string;
    @Column({ type: 'varchar', length: 50, default: PinType.EVENT })
    type: string;
    @Column({ name: 'poster_name', type: 'varchar', length: 255, nullable: true })
    poster_name: string;
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'posted_by' })
    poster: User;
    @Column({ name: 'posted_by', type: 'uuid', nullable: true })
    posted_by: string;
    @Column({
        type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json',
        ...(process.env.DB_TYPE === 'postgres'
            ? { ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Geometry' } : {}), srid: 4326 } : {}) }
            : {}),
    })
    location: any;
    @Column({ nullable: true })
    city: string;
    @Column({ nullable: true })
    district: string;
    @Column({ nullable: true })
    province: string;
    @Column({ type: 'varchar', length: 100, default: PinStatus.PENDING })
    status: string;
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
    photos: string[];
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
    tags: string[];
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
    @DeleteDateColumn()
    deleted_at: Date;
}
