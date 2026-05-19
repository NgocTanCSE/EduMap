import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('scholarships')
export class Scholarship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  provider: string; // University/Gov/Org

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location: any;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  value_amount: number;

  @Column({ nullable: true })
  deadline: Date;

  @Column({ type: 'jsonb', nullable: true })
  eligibility_criteria: string[];

  @Column({ nullable: true })
  apply_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
