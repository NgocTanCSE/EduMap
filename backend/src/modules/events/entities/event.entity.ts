import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'workshop' }) // workshop, hackathon, seminar, camp
  type: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'timestamp with time zone' })
  start_date: Date;

  @Column({ type: 'timestamp with time zone' })
  end_date: Date;

  @Column({ default: 100 })
  capacity: number;

  @Column({ default: 0 })
  registered_count: number;

  @Column({ nullable: true })
  banner_url: string;

  @Column({ nullable: true })
  organizer_id: string;

  @Column({ default: 'upcoming' }) // upcoming, active, completed, cancelled
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  user_id: string;

  @Column({ default: 'registered' }) // registered, attended, cancelled
  status: string;

  @Column({ unique: true })
  ticket_code: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  checked_in_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
