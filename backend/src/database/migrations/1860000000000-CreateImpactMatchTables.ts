import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create sponsor_profiles and sponsor_needs tables (ImpactMatch — Idea #9).
 *
 * SQLite-compatible: uses CREATE TABLE IF NOT EXISTS and JSON/TEXT types that
 * work on both SQLite (HF Spaces) and PostgreSQL (local / production).
 * The column types are chosen so TypeORM's entity validators — which read
 * `process.env.DB_TYPE` at module load — see a consistent schema.
 */
export class CreateImpactMatchTables1860000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // sponsor_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sponsor_profiles" (
        "id" varchar NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "focus_areas" json DEFAULT '[]',
        "budget_amount" decimal(15,2) DEFAULT 0,
        "budget_currency" varchar(10) DEFAULT 'VND',
        "location" varchar(255),
        "website_url" varchar,
        "contact_email" varchar(255),
        "status" text DEFAULT 'active',
        "is_verified" boolean DEFAULT false,
        "created_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_profiles_location"
      ON "sponsor_profiles" ("location")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_profiles_status"
      ON "sponsor_profiles" ("status")
    `);

    // sponsor_needs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sponsor_needs" (
        "id" varchar NOT NULL DEFAULT gen_random_uuid(),
        "title" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100) NOT NULL,
        "urgency" text DEFAULT 'medium',
        "cost_estimate" decimal(15,2) DEFAULT 0,
        "location" varchar(255),
        "status" text DEFAULT 'open',
        "tags" json DEFAULT '[]',
        "apply_url" varchar,
        "provenance" text,
        "created_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_needs_category"
      ON "sponsor_needs" ("category")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_needs_status"
      ON "sponsor_needs" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_needs_urgency"
      ON "sponsor_needs" ("urgency")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sponsor_needs_location"
      ON "sponsor_needs" ("location")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_needs_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_needs_urgency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_needs_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_needs_category"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sponsor_needs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_profiles_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sponsor_profiles_location"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sponsor_profiles"`);
  }
}
