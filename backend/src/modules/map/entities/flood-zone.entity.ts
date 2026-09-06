import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('flood_zones')
@Index(['coordinates'], { spatial: true })
export class FloodZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326 })
  coordinates: any; // GeoJSON Polygon/MultiPolygon

  @Column({ type: 'varchar', length: 50, default: 'seasonal' })
  riskLevel: 'low' | 'medium' | 'high' | 'seasonal';

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    source?: string;
    lastUpdated?: string;
    floodMonths?: number[]; // [5,6,7,8,9,10] for rainy season
    depthEstimate?: number; // meters
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}