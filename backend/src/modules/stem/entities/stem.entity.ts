import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('stem_labs')
export class StemLab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index({ spatial: true })
  @Column({
    name: 'location_point',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: any;

  @Column({ type: 'text', array: true, default: '{}' })
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
