import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('hackathons')
export class Hackathon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp with time zone' })
  start_date: Date;

  @Column({ type: 'timestamp with time zone' })
  end_date: Date;

  @Column({ default: 'upcoming' })
  status: string; // upcoming, ongoing, completed

  @CreateDateColumn()
  created_at: Date;
}
