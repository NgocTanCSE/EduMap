import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMapSchemaFix1790000000001 implements MigrationInterface {
    name = 'AddMapSchemaFix1790000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create missing map_categories table (referenced by map_points.type_id)
        await queryRunner.query(`CREATE TABLE "map_categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "icon" character varying, "color" character varying(7), "parent_id" integer, "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_5c6e4a0f8f9f5c6e4a0f8f9f5c" PRIMARY KEY ("id"))`);
        
        // Create missing location_categories table (referenced by locations.category_id)
        await queryRunner.query(`CREATE TABLE "location_categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "display_name" character varying, "icon_name" character varying, "marker_color" character varying, CONSTRAINT "UQ_location_categories_name" UNIQUE ("name"), CONSTRAINT "PK_location_categories_id" PRIMARY KEY ("id"))`);

        // Add missing district and province columns to map_points table
        await queryRunner.query(`ALTER TABLE "map_points" ADD COLUMN "district" character varying`);
        await queryRunner.query(`ALTER TABLE "map_points" ADD COLUMN "province" character varying`);
        
        // Add verified column to map_points table (missing from initial migration)
        await queryRunner.query(`ALTER TABLE "map_points" ADD COLUMN "verified" boolean NOT NULL DEFAULT false`);
        
        // Add foreign key for map_points.type_id
        await queryRunner.query(`ALTER TABLE "map_points" ADD CONSTRAINT "FK_map_points_type" FOREIGN KEY ("type_id") REFERENCES "map_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        
        // Create missing locations table
        await queryRunner.query(`CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "category_id" integer, "coordinates" geography(Point,4326) NOT NULL, "address" character varying, "city" character varying, "photos" jsonb, "rating_avg" numeric(3,2) NOT NULL DEFAULT '0', "rating_count" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'active', "is_verified" boolean NOT NULL DEFAULT false, "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_locations_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_locations_coordinates" ON "locations" USING GiST ("coordinates")`);

        // Add foreign keys for locations table
        await queryRunner.query(`ALTER TABLE "locations" ADD CONSTRAINT "FK_locations_category" FOREIGN KEY ("category_id") REFERENCES "location_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "locations" ADD CONSTRAINT "FK_locations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "locations" DROP CONSTRAINT "FK_locations_created_by"`);
        await queryRunner.query(`ALTER TABLE "locations" DROP CONSTRAINT "FK_locations_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_locations_coordinates"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`DROP TABLE "location_categories"`);
        await queryRunner.query(`DROP TABLE "map_categories"`);
        await queryRunner.query(`ALTER TABLE "map_points" DROP CONSTRAINT "FK_map_points_type"`);
        await queryRunner.query(`ALTER TABLE "map_points" DROP COLUMN "verified"`);
        await queryRunner.query(`ALTER TABLE "map_points" DROP COLUMN "province"`);
        await queryRunner.query(`ALTER TABLE "map_points" DROP COLUMN "district"`);
    }
}