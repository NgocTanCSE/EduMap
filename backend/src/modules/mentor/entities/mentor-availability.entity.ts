import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Mentor } from './mentor.entity';
@Entity('mentor_availabilities')
export class MentorAvailability {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @ManyToOne(() => Mentor)
    @JoinColumn({ name: 'mentor_id' })
    mentor: Mentor;
    @Column()
    mentor_id: string;
    @Column({ type: 'int' })
    day_of_week: number;
    @Column({ type: 'time' })
    start_time: string;
    @Column({ type: 'time' })
    end_time: string;
    @Column({ default: true })
    is_active: boolean;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
