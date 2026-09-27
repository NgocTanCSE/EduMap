import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1790000000002 implements MigrationInterface {
    name = 'AddUserProfileFields1790000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm date_of_birth và major vào bảng users
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "date_of_birth" DATE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "major" character varying(255)`);

        // Thêm notification_settings vào bảng user_preferences
        await queryRunner.query(`ALTER TABLE "user_preferences" ADD COLUMN "notification_settings" TEXT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_preferences" DROP COLUMN "notification_settings"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "major"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "date_of_birth"`);
    }
}
