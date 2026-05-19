import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ type: 'timestamp with time zone' }) date: Date;
  @Column() location: string;
  @Column({ default: 0 }) registered_count: number; // FIXED: Thêm c?t này
  @CreateDateColumn() created_at: Date;
}

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() event_id: string;
  @Column() user_id: string;
  @Column({ unique: true }) ticket_code: string;
  @Column({ default: false }) is_attended: boolean;
  @CreateDateColumn() registered_at: Date;
}

