import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('mobile_units')
export class MobileUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // library/classroom/tech_bus

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  driver_name: string;

  @Column({ nullable: true })
  contact_number: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  current_location: any;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('mobile_unit_routes')
export class MobileUnitRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  mobile_unit_id: string;

  @Column()
  destination_name: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: any;

  @Column()
  scheduled_at: Date;

  @Column({ default: 'pending' })
  status: string; // pending, in_progress, completed, cancelled
}
