// MentorRelationship entity linking mentors with mentees (students)
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Mentor } from './mentor.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('mentor_relationships')
export class MentorRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Mentor)
  @JoinColumn({ name: 'mentor_id' })
  mentor: Mentor;

  @Column()
  mentor_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column({ default: 'active' })
  status: string; // active/inactive

  @CreateDateColumn()
  created_at: Date;
}
