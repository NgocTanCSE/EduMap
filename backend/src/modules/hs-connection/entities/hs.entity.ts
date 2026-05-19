import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('university_counseling')
export class UniversityCounseling {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  university_name: string;

  @Column({ type: 'text', nullable: true })
  program_info: string;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ type: 'jsonb', nullable: true })
  admission_criteria: any;

  @CreateDateColumn()
  created_at: Date;
}
