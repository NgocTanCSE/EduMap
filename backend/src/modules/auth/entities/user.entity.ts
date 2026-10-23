import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToOne } from 'typeorm';
import { UserPreference } from './user-preference.entity';
import { datetimeColumn, enumColumn, textArrayColumn } from '../../../common/utils/db-column.utils';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  GUEST = 'guest',
  STUDENT = 'student',
  PARENT = 'parent',
  TEACHER = 'teacher',
  MENTOR = 'mentor',
  SCHOOL_REP = 'school_rep',
  UNIVERSITY_REP = 'university_rep',
  DONOR = 'donor',
  EMPLOYER = 'employer',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
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

  @Column({ name: 'two_factor_secret', type: 'varchar', nullable: true, select: false })
  twoFactorSecret: string;

  @Column({ name: 'is_two_factor_enabled', default: false })
  isTwoFactorEnabled: boolean;

  @Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true, select: false })
  refreshTokenHash: string;

  @Column({
    ...enumColumn(),
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  /** Ngày sinh (Date of Birth) — dùng để tính độ tuổi, lộ trình học tập */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  date_of_birth: Date;

  /** Ngành học / Chuyên ngành — ví dụ: Công nghệ Thông tin, Kế toán... */
  @Column({ name: 'major', type: 'varchar', length: 255, nullable: true })
  major: string;

  // `role` uses the enumColumn() helper: native PostgreSQL ENUM on Postgres,
  // TEXT on SQLite (HF Spaces). The previous magic-integer getter/setter was
  // removed per CA02 (docs/all-documents/CA02_ROLE_REFACTOR.md §6).

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

  @Column(textArrayColumn())
  skills: string[];

  @Column(textArrayColumn())
  interests: string[];

  @Column({ default: 0 })
  points: number;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: false })
  email_verified: boolean;

  // `timestamp` (Postgres) / `datetime` (SQLite). The Postgres driver has no
  // native `datetime` type and crashes bootstrap, so always go through the
  // datetimeColumn() helper instead of an inline ternary.
  @Column(datetimeColumn(true))
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
