import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create resources, resource_requests, resource_matches tables
 * (Resource Exchange AI — Idea #18).
 *
 * SQLite-compatible: uses CREATE TABLE IF NOT EXISTS and JSON/TEXT types that
 * work on both SQLite (HF Spaces) and PostgreSQL (local / production).
 * Column types are chosen so TypeORM's entity validators — which read
 * `process.env.DB_TYPE` at module load — see a consistent schema.
 */
export class CreateResourceExchangeTables1870000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // resources
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resources" (
        "id" varchar NOT NULL DEFAULT gen_random_uuid(),
        "type" text NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "condition" int DEFAULT 5,
        "location" varchar(255) NOT NULL,
        "lat" decimal(10,7),
        "lng" decimal(10,7),
        "available_from" text DEFAULT NULL,
        "cost" decimal(15,2) DEFAULT 0,
        "contact_method" varchar(255),
        "status" text DEFAULT 'available',
        "is_verified" boolean DEFAULT false,
        "tags" json DEFAULT '[]',
        "metadata" json,
        "created_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resources_type" ON "resources" ("type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resources_status" ON "resources" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resources_location" ON "resources" ("location")`);

    // resource_requests
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_requests" (
        "id" varchar NOT NULL DEFAULT gen_random_uuid(),
        "need_type" text NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "urgency" text DEFAULT 'medium',
        "location" varchar(255) NOT NULL,
        "lat" decimal(10,7),
        "lng" decimal(10,7),
        "deadline" text DEFAULT NULL,
        "preferred_min_condition" int DEFAULT 0,
        "contact_method" varchar(255),
        "status" text DEFAULT 'open',
        "tags" json DEFAULT '[]',
        "created_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_requests_need_type" ON "resource_requests" ("need_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_requests_status" ON "resource_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_requests_urgency" ON "resource_requests" ("urgency")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_requests_location" ON "resource_requests" ("location")`);

    // resource_matches
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_matches" (
        "id" varchar NOT NULL DEFAULT gen_random_uuid(),
        "resource_id" varchar NOT NULL,
        "request_id" varchar NOT NULL,
        "match_score" decimal(5,2) DEFAULT 0,
        "explanation" text,
        "status" text DEFAULT 'pending',
        "scheduled_pickup" text DEFAULT NULL,
        "transport_plan" text DEFAULT NULL,
        "created_by" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_matches_resource_id" ON "resource_matches" ("resource_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_matches_request_id" ON "resource_matches" ("request_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_resource_matches_status" ON "resource_matches" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_matches_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_matches_request_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_matches_resource_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_matches"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_requests_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_requests_urgency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resource_requests_need_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_requests"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resources_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resources_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resources_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resources"`);
  }
}
