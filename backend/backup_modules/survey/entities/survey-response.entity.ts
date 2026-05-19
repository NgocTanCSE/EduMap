import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Survey } from './survey.entity';

@Entity('survey_responses')
export class SurveyResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Survey)
  survey: Survey;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'jsonb' })
  answers_json: any;

  @CreateDateColumn()
  created_at: Date;
}
