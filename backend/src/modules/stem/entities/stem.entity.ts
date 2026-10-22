import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { textArrayColumn } from '../../../common/utils/db-column.utils';

@Entity('stem_labs')
export class StemLab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'location_point',
    type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json',
    ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) } : {}),
    nullable: true,
  })
  location: any;

  @Column(textArrayColumn())
  equipment: string[];

  @Column({ default: 0 })
  capacity: number;

  @Column({ default: true })
  booking_available: boolean;

  @Column({ nullable: true })
  contact: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
