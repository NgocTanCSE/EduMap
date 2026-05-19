import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Hackathon } from './hackathon.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('hackathon_teams')
export class HackathonTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  team_name: string;

  @ManyToOne(() => Hackathon)
  @JoinColumn({ name: 'hackathon_id' })
  hackathon: Hackathon;

  @Column()
  hackathon_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @Column()
  leader_id: string;

  @Column('text', { array: true, default: '{}' })
  members: string[];

  @Column({ nullable: true })
  repo_url: string;

  @Column({ nullable: true })
  demo_video: string;

  @Column({ default: 'registered' })
  status: string; // registered, submitted, judged

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @CreateDateColumn()
  created_at: Date;
}
