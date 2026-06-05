import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToOne } from 'typeorm';
import { UserPreference } from './user-preference.entity';

export enum UserRole {
  GUEST = 'guest',
  STUDENT = 'student',
  PARENT = 'parent',
  TEACHER = 'teacher',
  MENTOR = 'mentor',
  SCHOOL_REP = 'school_rep',
  DONOR = 'donor',
  EMPLOYER = 'employer',
  ADMIN = 'admin',
  COMMUNITY_COORD = 'community_coord',
  SUPPORT_STAFF = 'support_staff',
  PARTNER = 'partner',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  twoFactorSecret: string;

  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshTokenHash: string;

  @Column({ name: 'role_id', default: 11 })
  role_id: number;

  get role(): UserRole {
    const rolesMap: { [key: number]: UserRole } = {
      1: UserRole.ADMIN,
      2: UserRole.ADMIN,
      3: UserRole.ADMIN,
      8: UserRole.TEACHER,
      9: UserRole.MENTOR,
      11: UserRole.STUDENT,
    };
    return rolesMap[this.role_id] || UserRole.STUDENT;
  }

  set role(val: UserRole) {
    const idsMap: { [key in UserRole]?: number } = {
      [UserRole.ADMIN]: 2,
      [UserRole.TEACHER]: 8,
      [UserRole.MENTOR]: 9,
      [UserRole.STUDENT]: 11,
    };
    this.role_id = idsMap[val] || 11;
  }

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  mbti_type: string;

  @Column({ type: 'text', array: true, default: '{}' })
  skills: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  interests: string[];

  @Column({ default: 0 })
  points: number;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @OneToOne(() => UserPreference, (prefs) => prefs.user, { cascade: true })
  preferences: UserPreference;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
