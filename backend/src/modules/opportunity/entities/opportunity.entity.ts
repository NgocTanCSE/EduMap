import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('opportunities')
export class Opportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  category: string; // exchange/competition/grant/internship

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index({ spatial: true })
  @Column({
    name: 'location_point',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: any;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deadline: Date;

  @Column({ default: false })
  is_team_finding_open: boolean;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
