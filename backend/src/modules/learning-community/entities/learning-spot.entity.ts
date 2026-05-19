import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('learning_spots')
export class LearningSpot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ nullable: true })
  type: string; // cafe, library, study_space

  @Column({ default: true })
  has_wifi: boolean;

  @Column({ default: true })
  has_power_outlets: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @Column({ default: 50 })
  total_capacity: number; // Sức chứa tối đa của địa điểm học tập

  @CreateDateColumn()
  created_at: Date;
}
