import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

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

  @Column({
    name: 'location_point',
    type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json',
    ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) } : {}),
    nullable: true,
  })
  location: any;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
  start_date: Date;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime' })
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

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  checked_in_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
