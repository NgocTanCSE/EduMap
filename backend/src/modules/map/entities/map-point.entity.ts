import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

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
      1: 'school',
      2: 'school',
      3: 'library',
      4: 'library',
      5: 'lab',
    };
    return typesMap[this.type_id] || 'other';
  }

  set type(val: string) {
    const idsMap: { [key: string]: number } = {
      'school': 1,
      'library': 3,
      'lab': 5,
    };
    this.type_id = idsMap[val] || 1;
  }

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @Column({ default: 0 })
  rating_count: number;

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
