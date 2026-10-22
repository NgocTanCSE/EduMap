import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CA02 (HIGH RISK): Replace magic-integer `role_id` with a native PostgreSQL
 * ENUM column `role` on `users`.
 *
 * WHY this is needed
 *  - The current role_id → UserRole getter has 3 bugs (see CA02_ROLE_REFACTOR.md):
 *    • role_id 5 (University Rep) has NO entry → defaults to STUDENT
 *    • role_id 1 (Super Admin) and 2 (Admin) BOTH map to ADMIN (distinction lost)
 *    • Collisions: role_id 12 ← GUEST|PARENT|SUPPORT_STAFF, role_id 6 ← EMPLOYER|PARTNER
 *  - The UserRole TS enum (13 keys) does NOT match the `roles` DB table (12 rows).
 *  - Native enum removes the fragile integer-magic-number indirection entirely.
 *
 * ⚠️  NOT YET APPLIED.  Requires a full DB backup + coordinated code changes
 *     before running `typeorm migration:run`.  See deployment plan in
 *     docs/all-documents/CA02_ROLE_REFACTOR.md.
 *
 * Strategy: ADDitive (zero-downtime)
 *  1. CREATE TYPE user_role_enum AS ENUM (12 values, matching `roles` table)
 *  2. ADD COLUMN role  user_role_enum  (nullable, default NULL)
 *  3. Backfill role from role_id via a JOIN on the `roles` table (not hardcoded
 *     — reads actual role.id ↔ role.name from the DB)
 *  4. ALTER COLUMN role SET DEFAULT 'student'  (fills future gaps)
 *  5. ALTER COLUMN role SET NOT NULL  (data quality gate)
 *  6. role_id column is LEFT INTACT for a transition period (app + ORM still
 *     read role_id until all @Roles guards / auth.service are migrated).
 *     A follow-up migration drops role_id once the codebase is fully migrated.
 */
export class CreateUserRoleEnum1830000000000 implements MigrationInterface {
    Name = 'CreateUserRoleEnum1830000000000';

    // Matches backend/src/database/seed.sql roles table (the DB source of truth).
    // Values are normalised to lowercase-with-underscores to match the TS enum.
    private static readonly ROLE_ENUM_VALUES = [
        'super_admin',      // roles.id 1  (Super Admin — FIX: was conflated with ADMIN)
        'admin',            // roles.id 2  (Admin)
        'moderator',        // roles.id 3
        'school_rep',       // roles.id 4
        'university_rep',   // roles.id 5  (FIX: getter defaulted this to STUDENT)
        'business_partner', // roles.id 6  (Business Partner / Employer)
        'sponsor',          // roles.id 7  (Sponsor — was mapped to DONOR)
        'teacher',          // roles.id 8
        'mentor',           // roles.id 9
        'volunteer',        // roles.id 10 (Volunteer — was mapped to COMMUNITY_COORD)
        'student',          // roles.id 11
        'guest',            // roles.id 12
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the native Postgres enum type.
        const values = CreateUserRoleEnum1830000000000.ROLE_ENUM_VALUES.map((v) => `'${v}'`).join(', ');
        await queryRunner.query(`CREATE TYPE user_role_enum AS ENUM (${values})`);

        // 2. Add the new role column (nullable — backfill happens next).
        await queryRunner.query(`ALTER TABLE users ADD COLUMN role user_role_enum`);

        // 3. Backfill: JOIN on the roles table so the mapping comes from the
        //    DB, not from the (buggy) in-code getter.
        await queryRunner.query(`
            UPDATE users u
            SET role = CASE r.id
                WHEN  1 THEN 'super_admin'
                WHEN  2 THEN 'admin'
                WHEN  3 THEN 'moderator'
                WHEN  4 THEN 'school_rep'
                WHEN  5 THEN 'university_rep'
                WHEN  6 THEN 'business_partner'
                WHEN  7 THEN 'sponsor'
                WHEN  8 THEN 'teacher'
                WHEN  9 THEN 'mentor'
                WHEN 10 THEN 'volunteer'
                WHEN 11 THEN 'student'
                WHEN 12 THEN 'guest'
            END
            FROM roles r
            WHERE u.role_id = r.id
        `);

        // 4. Default for new users (no more magic 11).
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'student'`);

        // 5. NOT NULL gate — any row still NULL here was an orphan; surface it.
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL`);

        // 6. Index for performance (roles guard, dashboard analytics).
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

        // NOTE: role_id column is intentionally KEPT. See deployment plan.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_role`);
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE users DROP COLUMN role`);
        await queryRunner.query(`DROP TYPE user_role_enum`);
        // role_id is untouched (never dropped in up(), never recreated here).
    }
}
