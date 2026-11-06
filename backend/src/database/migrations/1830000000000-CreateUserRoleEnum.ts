import { MigrationInterface, QueryRunner } from "typeorm";
export class CreateUserRoleEnum1830000000000 implements MigrationInterface {
    Name = 'CreateUserRoleEnum1830000000000';
    private static readonly ROLE_ENUM_VALUES = [
        'super_admin',
        'admin',
        'moderator',
        'school_rep',
        'university_rep',
        'employer',
        'donor',
        'teacher',
        'mentor',
        'community_coord',
        'student',
        'guest',
        'parent',
        'support_staff',
        'partner',
    ];
    public async up(queryRunner: QueryRunner): Promise<void> {
        const values = CreateUserRoleEnum1830000000000.ROLE_ENUM_VALUES.map((v) => `'${v}'`).join(', ');
        await queryRunner.query(`CREATE TYPE user_role_enum AS ENUM (${values})`);
        await queryRunner.query(`ALTER TABLE users ADD COLUMN role user_role_enum`);
        await queryRunner.query(`
            UPDATE users u
            SET role = CASE r.id
                WHEN  1 THEN 'super_admin'
                WHEN  2 THEN 'admin'
                WHEN  3 THEN 'moderator'
                WHEN  4 THEN 'school_rep'
                WHEN  5 THEN 'university_rep'
                WHEN  6 THEN 'employer'
                WHEN  7 THEN 'donor'
                WHEN  8 THEN 'teacher'
                WHEN  9 THEN 'mentor'
                WHEN 10 THEN 'community_coord'
                WHEN 11 THEN 'student'
                WHEN 12 THEN 'guest'
                WHEN 13 THEN 'parent'
                WHEN 14 THEN 'support_staff'
                WHEN 15 THEN 'partner'
            END::user_role_enum
            FROM roles r
            WHERE u.role_id = r.id
        `);
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'student'::user_role_enum`);
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_role`);
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE users DROP COLUMN role`);
        await queryRunner.query(`DROP TYPE user_role_enum`);
    }
}
