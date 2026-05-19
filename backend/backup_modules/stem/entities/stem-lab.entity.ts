import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('stem_labs')
export class StemLab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: any;

  @Column({ type: 'text', array: true, default: '{}' })
  equipment: string[];

  @Column({ default: true })
  booking_available: boolean;

  @CreateDateColumn()
  created_at: Date;
}
