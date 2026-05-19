import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('stem_labs')
export class StemLab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
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
