import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('international_programs')
export class InternationalProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  type: string; // exchange/workshop/scholarship/seminar

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  host_country: string;

  @Column({ nullable: true })
  organization: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  application_deadline: Date;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json', nullable: true })
  benefits: string[];

  @Column({ nullable: true })
  apply_url: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('alumni_networks')
export class AlumniNetwork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  full_name: string;

  @Column()
  university: string;

  @Column()
  country: string;

  @Column()
  major: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json', ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) })
  location: any;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ default: 'studying' })
  status: string; // studying, graduated, returned

  @CreateDateColumn()
  created_at: Date;
}
