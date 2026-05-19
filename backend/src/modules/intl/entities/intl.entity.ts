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

  @Column({ type: 'timestamp with time zone', nullable: true })
  application_deadline: Date;

  @Column({ type: 'jsonb', nullable: true })
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

  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: any;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ default: 'studying' })
  status: string; // studying, graduated, returned

  @CreateDateColumn()
  created_at: Date;
}
