import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('locations')
export class WifiLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    name: 'coordinates',
    type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json',
    ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) } : {}),
    nullable: true,
  })
  location: any;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true, type: 'float' })
  speed_mbps: number;

  @Column({ default: true })
  is_free: boolean;

  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  password_hint: string;

  @Column({ default: false })
  verified: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  reporter: User;

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
