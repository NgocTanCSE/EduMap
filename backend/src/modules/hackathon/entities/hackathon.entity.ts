import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('hackathons')
export class Hackathon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  start_date: Date;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  end_date: Date;

  @Column({ default: 'upcoming' })
  status: string; // upcoming, ongoing, completed

  @CreateDateColumn()
  created_at: Date;
}
