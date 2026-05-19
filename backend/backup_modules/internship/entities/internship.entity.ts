import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from '../auth/entities/user.entity';

@Entity('internships')
export class Internship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  company: User;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  field: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: any;

  @Column({ nullable: true })
  salary_range: string;

  @Column()
  deadline: Date;

  @Column({ default: 'open' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
