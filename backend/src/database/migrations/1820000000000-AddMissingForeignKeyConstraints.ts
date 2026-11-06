import { MigrationInterface, QueryRunner } from "typeorm";
export class AddMissingForeignKeyConstraints1820000000000 implements MigrationInterface {
    Name = 'AddMissingForeignKeyConstraints1820000000000';
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = async (t: string): Promise<boolean> => {
            const r = await queryRunner.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]);
            return Array.isArray(r) && r.length > 0;
        };
        const columnExists = async (t: string, c: string): Promise<boolean> => {
            const r = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [t, c]);
            return Array.isArray(r) && r.length > 0;
        };
        const constraintExists = async (name: string): Promise<boolean> => {
            const r = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname=$1`, [name]);
            return Array.isArray(r) && r.length > 0;
        };
        if (await tableExists('organizations') && await columnExists('internships', 'company_id')) {
            await queryRunner.query(`
                UPDATE internships SET company_id = NULL
                WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM organizations)
            `);
        }
        if (await tableExists('career_paths') && await columnExists('jobs', 'career_path_id')) {
            await queryRunner.query(`
                UPDATE jobs SET career_path_id = NULL
                WHERE career_path_id IS NOT NULL AND career_path_id NOT IN (SELECT id FROM career_paths)
            `);
        }
        if (await tableExists('career_paths') && await columnExists('user_careers', 'career_path_id')) {
            await queryRunner.query(`
                UPDATE user_careers SET career_path_id = NULL
                WHERE career_path_id IS NOT NULL AND career_path_id NOT IN (SELECT id FROM career_paths)
            `);
        }
        if (await tableExists('organizations') && await columnExists('internships', 'company_id') && !(await constraintExists('fk_internships_company_id'))) {
            await queryRunner.query(`ALTER TABLE internships ADD CONSTRAINT fk_internships_company_id FOREIGN KEY (company_id) REFERENCES organizations(id) ON DELETE SET NULL`);
        }
        if (await tableExists('career_paths') && await columnExists('jobs', 'career_path_id') && !(await constraintExists('fk_jobs_career_path_id'))) {
            await queryRunner.query(`ALTER TABLE jobs ADD CONSTRAINT fk_jobs_career_path_id FOREIGN KEY (career_path_id) REFERENCES career_paths(id) ON DELETE SET NULL`);
        }
        if (await tableExists('career_paths') && await columnExists('user_careers', 'career_path_id') && !(await constraintExists('fk_user_careers_career_path_id'))) {
            await queryRunner.query(`ALTER TABLE user_careers ADD CONSTRAINT fk_user_careers_career_path_id FOREIGN KEY (career_path_id) REFERENCES career_paths(id) ON DELETE SET NULL`);
        }
        if (await tableExists('internships') && await columnExists('internships', 'company_id')) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internships_company_id ON internships(company_id)`);
        }
        if (await tableExists('jobs') && await columnExists('jobs', 'career_path_id')) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_jobs_career_path_id ON jobs(career_path_id)`);
        }
        if (await tableExists('user_careers') && await columnExists('user_careers', 'career_path_id')) {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_careers_career_path_id ON user_careers(career_path_id)`);
        }
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
