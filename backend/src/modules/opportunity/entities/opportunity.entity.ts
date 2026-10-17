import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('opportunities')
export class Opportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ name: 'type', nullable: true })
  category: string; // exchange/competition/grant/internship

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'location_point',
    type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json',
    ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) } : {}),
    nullable: true,
  })
  location: any;

  @Column({ nullable: true })
  address: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  deadline: Date;

  @Column({ default: false })
  is_team_finding_open: boolean;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  tags: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
