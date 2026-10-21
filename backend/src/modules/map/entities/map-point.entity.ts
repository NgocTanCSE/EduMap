import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { geoPointColumn, jsonColumn } from '../../../common/utils/db-column.utils';

@Entity('map_points')
export class MapPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'type_id', nullable: true })
  type_id: number;

  get type(): string {
    const typesMap: { [key: number]: string } = {
      1: 'university',
      2: 'school',
      3: 'library',
      4: 'bookstore',
      5: 'lab',
      6: 'wifi',
      7: 'green',
      8: 'cafe',
      9: 'restaurant',
      10: 'market',
      11: 'convenience',
    };
    return typesMap[this.type_id] || 'other';
  }

  set type(val: string) {
    const idsMap: { [key: string]: number } = {
      'university': 1,
      'school': 2,
      'library': 3,
      'bookstore': 4,
      'lab': 5,
      'wifi': 6,
      'green': 7,
      'park': 7,
      'cafe': 8,
      'restaurant': 9,
      'market': 10,
      'convenience': 11,
    };
    this.type_id = idsMap[val] || 1;
  }

  // Native geography(Point,4326) on Postgres, JSON on SQLite.
  // Extracted to geoPointColumn() — replaces the nested ternary that
  // re-checked DB_TYPE three times inside this decorator.
  @Column(geoPointColumn())
  location: any;

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

  @Column({ default: false })
  verified: boolean;

  @Column({ default: 'pending' })
  status: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
