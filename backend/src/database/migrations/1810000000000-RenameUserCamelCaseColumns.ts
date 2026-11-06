import { MigrationInterface, QueryRunner } from "typeorm";
export class RenameUserCamelCaseColumns1810000000000 implements MigrationInterface {
    Name = 'RenameUserCamelCaseColumns1810000000000';
    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasCol = async (col: string): Promise<boolean> => {
            const r = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=$1`, [col]);
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
            const r = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=$1`, [col]);
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
