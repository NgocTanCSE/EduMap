import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
@Entity('traffic_segments')
export class TrafficSegment {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ type: 'varchar', length: 100 })
    roadName: string;
    @Column({ type: 'varchar', length: 50 })
    roadType: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service' | 'unclassified';
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json', ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'LineString' } : {}), srid: 4326 } : {}) })
    coordinates: any;
    @Column({ type: 'float', default: 50 })
    freeFlowSpeed: number;
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
    congestionProfile: {
        hourlySpeedFactor: number[];
        dailyFactor: number[];
    };
    @Column({ type: 'int', default: 0 })
    congestionLevel: 0 | 1 | 2 | 3;
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime', nullable: true })
    lastObserved: Date;
    @Column({ type: 'varchar', length: 50, default: 'heuristic' })
    dataSource: 'heuristic' | 'live' | 'historical';
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
}
