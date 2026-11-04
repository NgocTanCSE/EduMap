import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1790000000002 implements MigrationInterface {
    name = 'AddUserProfileFields1790000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Thêm date_of_birth và major vào bảng users
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" DATE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "major" character varying(255)`);

        // Bảng user_preferences có thể chưa tồn tại (chưa có migration tạo nó).
        // Tạo nếu thiếu để migration không fail trên Postgres fresh.
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_preferences" (
                "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
                "language" VARCHAR(50) NOT NULL DEFAULT 'vi',
                "theme" VARCHAR(50) NOT NULL DEFAULT 'dark',
                "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
                "privacy_level" VARCHAR(50) NOT NULL DEFAULT 'public',
                "notification_settings" TEXT,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Thêm notification_settings vào bảng user_preferences (idempotent)
        await queryRunner.query(`ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "notification_settings" TEXT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_preferences" DROP COLUMN "notification_settings"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "major"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "date_of_birth"`);
    }
}
