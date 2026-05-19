import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('wifi_locations')
export class WifiLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: any;

  @Column({ default: true })
  is_free: boolean;

  @Column({ nullable: true })
  password_hint: string;

  @CreateDateColumn()
  created_at: Date;
}
