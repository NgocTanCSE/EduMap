import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMissingCareerHsAnalyticsTables1910000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "skill_name" character varying NOT NULL,
        "proficiency_level" character varying NOT NULL DEFAULT 'beginner',
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_skills" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_skills_user') THEN
          ALTER TABLE "user_skills" ADD CONSTRAINT "FK_user_skills_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_careers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "career_path_id" integer,
        "goal_title" character varying NOT NULL,
        "description" text,
        "target_date" date,
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_careers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_careers_user') THEN
          ALTER TABLE "user_careers" ADD CONSTRAINT "FK_user_careers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_careers_career_path') THEN
          ALTER TABLE "user_careers" ADD CONSTRAINT "FK_user_careers_career_path" FOREIGN KEY ("career_path_id") REFERENCES "career_paths"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "company_name" character varying,
        "location" character varying,
        "job_type" character varying NOT NULL DEFAULT 'full_time',
        "salary_range" character varying,
        "required_skills" jsonb,
        "experience_level" character varying,
        "application_deadline" date,
        "views" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'active',
        "posted_by_user_id" uuid,
        "career_path_id" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_jobs_posted_by') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "FK_jobs_posted_by" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_jobs_career_path') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "FK_jobs_career_path" FOREIGN KEY ("career_path_id") REFERENCES "career_paths"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "cover_letter" text,
        "resume_url" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_applications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_applications_user') THEN
          ALTER TABLE "applications" ADD CONSTRAINT "FK_applications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_applications_job') THEN
          ALTER TABLE "applications" ADD CONSTRAINT "FK_applications_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" uuid NOT NULL,
        "receiver_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_connections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_student_connections_requester') THEN
          ALTER TABLE "student_connections" ADD CONSTRAINT "FK_student_connections_requester" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_student_connections_receiver') THEN
          ALTER TABLE "student_connections" ADD CONSTRAINT "FK_student_connections_receiver" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_student_connections_pair" ON "student_connections" ("requester_id", "receiver_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "university_counseling" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "university_name" character varying NOT NULL,
        "program_info" text,
        "contact_email" character varying,
        "admission_criteria" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_university_counseling" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hs_questions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "university_target" character varying,
        "view_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hs_questions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_hs_questions_student') THEN
          ALTER TABLE "hs_questions" ADD CONSTRAINT "FK_hs_questions_student" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hs_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL,
        "mentor_id" uuid NOT NULL,
        "content" text NOT NULL,
        "is_verified_answer" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hs_answers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_hs_answers_question') THEN
          ALTER TABLE "hs_answers" ADD CONSTRAINT "FK_hs_answers_question" FOREIGN KEY ("question_id") REFERENCES "hs_questions"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_hs_answers_mentor') THEN
          ALTER TABLE "hs_answers" ADD CONSTRAINT "FK_hs_answers_mentor" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookmarks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "target_type" character varying(50) NOT NULL,
        "target_id" character varying(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookmarks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bookmarks_user_target" ON "bookmarks" ("user_id", "target_type", "target_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_bookmarks_user') THEN
          ALTER TABLE "bookmarks" ADD CONSTRAINT "FK_bookmarks_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "message" text NOT NULL,
        "response" text NOT NULL,
        "context" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_histories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_chat_histories_user') THEN
          ALTER TABLE "chat_histories" ADD CONSTRAINT "FK_chat_histories_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "event_type" character varying NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_events_user') THEN
          ALTER TABLE "user_events" ADD CONSTRAINT "FK_user_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_histories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookmarks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hs_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hs_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "university_counseling"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_connections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_careers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_skills"`);
  }
}