import { MigrationInterface, QueryRunner } from "typeorm";
export class AddMentorLocation1840000000000 implements MigrationInterface {
    name = 'AddMentorLocation1840000000000';
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mentors" ADD COLUMN "location" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "location" character varying(255)`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "mentors" DROP COLUMN "location"`);
    }
}
