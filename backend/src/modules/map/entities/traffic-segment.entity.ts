import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('traffic_segments')
// spatial index removed — not supported on SQLite
export class TrafficSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  roadName: string;

  @Column({ type: 'varchar', length: 50 })
  roadType: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service' | 'unclassified';

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json', ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'LineString' } : {}), srid: 4326 } : {}) })
  coordinates: any; // GeoJSON LineString

  @Column({ type: 'float', default: 50 })
  freeFlowSpeed: number; // km/h

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  congestionProfile: {
    // Peak hour multipliers (0-24h)
    hourlySpeedFactor: number[]; // 24 values, e.g., [0.9, 0.9, ..., 0.6, 0.5, ...]
    // Day of week multipliers
    dailyFactor: number[]; // 7 values
  };

  @Column({ type: 'int', default: 0 })
  congestionLevel: 0 | 1 | 2 | 3; // 0=free, 1=light, 2=moderate, 3=heavy

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime', nullable: true })
  lastObserved: Date;

  @Column({ type: 'varchar', length: 50, default: 'heuristic' })
  dataSource: 'heuristic' | 'live' | 'historical';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}