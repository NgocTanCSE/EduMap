import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('wifi_locations')
export class WifiLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  speed_mbps: number;

  @Column({ default: true })
  is_free: boolean;

  @Column({ nullable: true })
  password: string;

  @Column({ default: false })
  verified: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_by' })
  reporter: User;

  @Column({ nullable: true })
  reported_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
