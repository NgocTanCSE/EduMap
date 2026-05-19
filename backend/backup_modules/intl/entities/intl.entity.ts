import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
