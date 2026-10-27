import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { LocationCategory } from './location-category.entity';
import { geoPointColumn, jsonColumn } from '../../../common/utils/db-column.utils';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => LocationCategory)
  @JoinColumn({ name: 'category_id' })
  category: LocationCategory;

  // Nullable on purpose: the shipped SQLite DB contains ~3.2k real POIs
  // imported without a category (parks, bus stops, restaurants…). Declaring
  // this NOT NULL made TypeORM's `synchronize` die with
  // `SQLITE_CONSTRAINT: NOT NULL constraint failed: temporary_locations.category_id`
  // and blocked the backend from booting with DB_SYNC=true.
  @Column({ nullable: true })
  category_id: number;

  @Column(geoPointColumn())
  coordinates: any;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column(jsonColumn(true))
  photos: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @Column({ default: 0 })
  rating_count: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
