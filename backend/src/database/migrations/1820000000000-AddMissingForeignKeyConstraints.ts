import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CA04: Add missing FOREIGN KEY constraints flagged in IMPROVEMENT_PLAN.
 *
 *  - internships.company_id   (UUID)   → organizations(id)
 *  - jobs.career_path_id      (INTEGER) → career_paths(id)
 *  - user_careers.career_path_id (INTEGER) → career_paths(id)
 *    (user_careers is the same missing-FK pattern as jobs; included for
 *     consistency even though the original plan only listed `jobs`.)
 *
 * SAFETY:
 *  - All three columns are nullable, so orphan rows are NULLed BEFORE the
 *    FK is added (no data loss for valid references).
 *  - ON DELETE SET NULL — future deletions of the parent row null out the
 *    FK column instead of blocking the delete (sensible for optional links).
 *  - Idempotent: CREATE INDEX IF NOT EXISTS; constraint names are unique.
 *  - Compatible with PostgreSQL (primary — data-source.ts type: 'postgres')
 *    and SQLite (SQLite ignores FK enforcement unless PRAGMA foreign_keys=ON,
 *    so this is a no-op risk for the static edumap.db).
 *
 * KNOWN MODELING BUG (NOT FIXED HERE — out of CA04 scope):
 *  - internship.entity.ts declares @ManyToOne(() => User) for `company_id`,
 *    but the schema + column name + Organization entity indicate the FK
 *    target should be `organizations`. Changing the ORM relation type alters
 *    JOIN behavior and requires coordinated entity + service changes.
 *    Tracked separately; this migration enforces the DB-level constraint
 *    to the semantically-correct `organizations(id)`.
 */
export class AddMissingForeignKeyConstraints1820000000000 implements MigrationInterface {
    Name = 'AddMissingForeignKeyConstraints1820000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- 1. Clean orphaned references (columns are nullable) ---
        await queryRunner.query(`
            UPDATE internships SET company_id = NULL
            WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM organizations)
        `);
        await queryRunner.query(`
            UPDATE jobs SET career_path_id = NULL
            WHERE career_path_id IS NOT NULL AND career_path_id NOT IN (SELECT id FROM career_paths)
        `);
        await queryRunner.query(`
            UPDATE user_careers SET career_path_id = NULL
            WHERE career_path_id IS NOT NULL AND career_path_id NOT IN (SELECT id FROM career_paths)
        `);

        // --- 2. Add FK constraints (ON DELETE SET NULL — nullable columns) ---
        await queryRunner.query(`ALTER TABLE internships ADD CONSTRAINT fk_internships_company_id FOREIGN KEY (company_id) REFERENCES organizations(id) ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE jobs ADD CONSTRAINT fk_jobs_career_path_id FOREIGN KEY (career_path_id) REFERENCES career_paths(id) ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE user_careers ADD CONSTRAINT fk_user_careers_career_path_id FOREIGN KEY (career_path_id) REFERENCES career_paths(id) ON DELETE SET NULL`);

        // --- 3. Indexes for query performance ---
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internships_company_id ON internships(company_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_jobs_career_path_id ON jobs(career_path_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_careers_career_path_id ON user_careers(career_path_id)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_careers_career_path_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_jobs_career_path_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_internships_company_id`);
        await queryRunner.query(`ALTER TABLE user_careers DROP CONSTRAINT IF EXISTS fk_user_careers_career_path_id`);
        await queryRunner.query(`ALTER TABLE jobs DROP CONSTRAINT IF EXISTS fk_jobs_career_path_id`);
        await queryRunner.query(`ALTER TABLE internships DROP CONSTRAINT IF EXISTS fk_internships_company_id`);
    }
}
