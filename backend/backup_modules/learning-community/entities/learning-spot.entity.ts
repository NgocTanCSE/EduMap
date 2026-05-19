import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('learning_spots')
export class LearningSpot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ nullable: true })
  type: string; // cafe/library/study_space

  @Column({ default: true })
  has_wifi: boolean;

  @Column({ default: true })
  has_power_outlets: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: number;

  @CreateDateColumn()
  created_at: Date;
}
