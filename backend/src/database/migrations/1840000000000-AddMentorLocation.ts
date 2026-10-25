import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ADR-006 follow-up: Add geographic `location` column to `mentors` and `users`
 * tables to enable DB-level region pre-filtering (cự ly) in MentorService.
 *
 * The mentor-matching feature accepts a `region` query param but, prior to
 * this migration, only forwarded it to the LLM as prompt metadata — no DB-level
 * geographic filtering existed because the column did not exist on either the
 * mentors or users table.
 */
export class AddMentorLocation1840000000000 implements MigrationInterface {
    name = 'AddMentorLocation1840000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mentors" ADD COLUMN "location" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "location" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "mentors" DROP COLUMN "location"`);
    }
}
