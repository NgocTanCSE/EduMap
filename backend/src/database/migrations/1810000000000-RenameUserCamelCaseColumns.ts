import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CA03: Rename 3 camelCase columns in `users` → snake_case.
 * Columns: twoFactorSecret → two_factor_secret,
 *          isTwoFactorEnabled → is_two_factor_enabled,
 *          refreshTokenHash → refresh_token_hash
 *
 * SAFETY: All TypeScript service/controller code accesses these via the
 * entity's JS *property* names (isTwoFactorEnabled, twoFactorSecret),
 * NOT the DB column names. The @Column({ name: 'snake_case' }) mapping in
 * user.entity.ts bridges the property → column. So no .ts source changes
 * are needed beyond the entity mapping + this migration + schema.sql.
 *
 * Applied automatically by TypeORM `runMigrations()` on backend startup
 * (data-source.ts → migrations glob). PostgreSQL + SQLite both support
 * `ALTER TABLE ... RENAME COLUMN`.
 */
export class RenameUserCamelCaseColumns1810000000000 implements MigrationInterface {
    Name = 'RenameUserCamelCaseColumns1810000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "twoFactorSecret" TO "two_factor_secret"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "isTwoFactorEnabled" TO "is_two_factor_enabled"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "refreshTokenHash" TO "refresh_token_hash"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "two_factor_secret" TO "twoFactorSecret"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "is_two_factor_enabled" TO "isTwoFactorEnabled"`);
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "refresh_token_hash" TO "refreshTokenHash"`);
    }
}
