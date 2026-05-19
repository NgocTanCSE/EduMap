import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('internships')
export class Internship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'company_id' })
  company: User;

  @Column()
  company_id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  field: string;

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
  salary_range: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deadline: Date;

  @Column({ default: 'open' }) // open, closed
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
