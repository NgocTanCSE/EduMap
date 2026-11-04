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
        // Idempotent: only rename when the legacy camelCase column actually exists.
        // On a fresh Postgres schema (InitialProductionSchema) the columns are
        // already snake_case, so there is nothing to do.
        const hasCol = async (col: string): Promise<boolean> => {
            const r = await queryRunner.query(
                `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=$1`,
                [col]
            );
            return Array.isArray(r) && r.length > 0;
        };
        if (await hasCol('twoFactorSecret')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "twoFactorSecret" TO "two_factor_secret"`);
        }
        if (await hasCol('isTwoFactorEnabled')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "isTwoFactorEnabled" TO "is_two_factor_enabled"`);
        }
        if (await hasCol('refreshTokenHash')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "refreshTokenHash" TO "refresh_token_hash"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasCol = async (col: string): Promise<boolean> => {
            const r = await queryRunner.query(
                `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=$1`,
                [col]
            );
            return Array.isArray(r) && r.length > 0;
        };
        if (await hasCol('two_factor_secret')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "two_factor_secret" TO "twoFactorSecret"`);
        }
        if (await hasCol('is_two_factor_enabled')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "is_two_factor_enabled" TO "isTwoFactorEnabled"`);
        }
        if (await hasCol('refresh_token_hash')) {
            await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "refresh_token_hash" TO "refreshTokenHash"`);
        }
    }
}
