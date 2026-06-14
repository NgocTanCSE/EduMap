import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('hs_questions')
export class HsQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column()
  student_id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  university_target: string;

  @Column({ default: 0 })
  view_count: number;

  @OneToMany(() => HsAnswer, (answer) => answer.question)
  answers: HsAnswer[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('hs_answers')
export class HsAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => HsQuestion, (question) => question.answers)
  @JoinColumn({ name: 'question_id' })
  question: HsQuestion;

  @Column()
  question_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'mentor_id' })
  mentor: User; // The university student answering

  @Column()
  mentor_id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  is_verified_answer: boolean;

  @CreateDateColumn()
  created_at: Date;
}
