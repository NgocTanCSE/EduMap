import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFloodAndTrafficTables1800000000000 implements MigrationInterface {
    name = 'CreateFloodAndTrafficTables1800000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── flood_zones table ──────────────────────────────────────────────
        // Matches FloodZone entity (flood-zone.entity.ts)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "flood_zones" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" varchar(255) NOT NULL,
                "description" text,
                "coordinates" geometry(Polygon, 4326) NOT NULL,
                "riskLevel" varchar(50) NOT NULL DEFAULT 'seasonal',
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_flood_zones_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_flood_zones_coordinates" ON "flood_zones" USING GIST ("coordinates")`);

        // ── traffic_segments table ─────────────────────────────────────────
        // Matches TrafficSegment entity (traffic-segment.entity.ts)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "traffic_segments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "roadName" varchar(100) NOT NULL,
                "roadType" varchar(50) NOT NULL DEFAULT 'residential',
                "coordinates" geometry(LineString, 4326) NOT NULL,
                "freeFlowSpeed" double precision NOT NULL DEFAULT 50,
                "congestionProfile" jsonb,
                "congestionLevel" integer NOT NULL DEFAULT 0,
                "lastObserved" TIMESTAMP,
                "dataSource" varchar(50) NOT NULL DEFAULT 'heuristic',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_traffic_segments_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_traffic_segments_coordinates" ON "traffic_segments" USING GIST ("coordinates")`);

        // ── Seed: flood zones around Đồng Nai river in Biên Hòa ──────────
        // These polygons cover known flood-prone areas (riverbanks, low-lying
        // streets). Coordinates are [lng, lat] per GeoJSON spec.
        await queryRunner.query(`
            INSERT INTO "flood_zones" ("id", "name", "description", "coordinates", "riskLevel", "metadata", "createdAt", "updatedAt")
            VALUES
            (
                'a1f1b2c3-0001-4aaa-8bbb-000000000001',
                'Khu vực ngập lũ khu phố 3 - sông Đồng Nai',
                'Khu vực thấp lưu đằng bờ sông Đồng Nai, thường xuyên ngập lụt vào mùa mưa',
                ST_GeomFromEWKT('SRID=4326;POLYGON((106.840 10.945, 106.860 10.945, 106.860 10.925, 106.840 10.925, 106.840 10.945))'),
                'high',
                '{"source": "local-authority", "floodMonths": [5, 6, 7, 8, 9, 10, 11], "depthEstimate": 0.5}',
                now(), now()
            ),
            (
                'a1f1b2c3-0002-4aaa-8bbb-000000000002',
                'Khu vực ngập lũ khu phố 2 - kênh phụ Đồng Nai',
                'Khu vực ven kênh phụ sông Đồng Nai, ngập lũ nhẹ khi mưa lớn',
                ST_GeomFromEWKT('SRID=4326;POLYGON((106.860 10.955, 106.880 10.955, 106.880 10.940, 106.860 10.940, 106.860 10.955))'),
                'seasonal',
                '{"source": "local-authority", "floodMonths": [5, 6, 7, 8, 9, 10, 11], "depthEstimate": 0.3}',
                now(), now()
            ),
            (
                'a1f1b2c3-0003-4aaa-8bbb-000000000003',
                'Khu vực ngập lũ ven sông Cóc Đĩa',
                'Khu vực đất thấp ven sông, ngập lũ thường xuyên vào mùa mưa',
                ST_GeomFromEWKT('SRID=4326;POLYGON((106.870 10.970, 106.895 10.970, 106.895 10.955, 106.870 10.955, 106.870 10.970))'),
                'seasonal',
                '{"source": "local-authority", "floodMonths": [5, 6, 7, 8, 9], "depthEstimate": 0.4}',
                now(), now()
            )
        `);

        // ── Seed: traffic segments for major Biên Hòa roads ────────────────
        // LineStrings representing main arteries; congestion profile uses the
        // same 24-element hourly speed-factor array as the heuristic profiles.
        const motorwayProfile = JSON.stringify([0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.85,0.9,0.95,0.95,0.95,0.95,0.95,0.9,0.7,0.6,0.7,0.8,0.9,0.95,0.95]);
        const primaryProfile = JSON.stringify([0.9,0.9,0.9,0.9,0.9,0.85,0.6,0.5,0.6,0.75,0.8,0.85,0.85,0.85,0.85,0.85,0.8,0.6,0.5,0.6,0.7,0.8,0.85,0.9]);

        await queryRunner.query(`
            INSERT INTO "traffic_segments" ("id", "roadName", "roadType", "coordinates", "freeFlowSpeed", "congestionProfile", "congestionLevel", "lastObserved", "dataSource", "createdAt", "updatedAt")
            VALUES
            (
                'b2c3d4e5-0001-4bbb-9ccc-111111111111',
                'Đường Nguyễn Khuyến',
                'primary',
                ST_GeomFromEWKT('SRID=4326;LINESTRING(106.872 10.950, 106.880 10.955)'),
                60,
                '${primaryProfile}',
                1,
                now(),
                'historical',
                now(), now()
            ),
            (
                'b2c3d4e5-0002-4bbb-9ccc-222222222222',
                'Đường Trần Phè',
                'primary',
                ST_GeomFromEWKT('SRID=4326;LINESTRING(106.870 10.960, 106.885 10.965)'),
                50,
                '${primaryProfile}',
                0,
                now(),
                'historical',
                now(), now()
            ),
            (
                'b2c3d4e5-0003-4bbb-9ccc-333333333333',
                'Đường Lê Duẩn',
                'motorway',
                ST_GeomFromEWKT('SRID=4326;LINESTRING(106.860 10.955, 106.900 10.960)'),
                100,
                '${motorwayProfile}',
                0,
                now(),
                'historical',
                now(), now()
            ),
            (
                'b2c3d4e5-0004-4bbb-9ccc-444444444444',
                'Đường Phạm Văn Đồng',
                'secondary',
                ST_GeomFromEWKT('SRID=4326;LINESTRING(106.875 10.940, 106.882 10.950)'),
                50,
                '${primaryProfile}',
                2,
                now(),
                'historical',
                now(), now()
            ),
            (
                'b2c3d4e5-0005-4bbb-9ccc-555555555555',
                'Đường Nguyễn Trãi',
                'secondary',
                ST_GeomFromEWKT('SRID=4326;LINESTRING(106.865 10.970, 106.875 10.975)'),
                50,
                '${primaryProfile}',
                0,
                now(),
                'historical',
                now(), now()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "flood_zones" WHERE "id" IN ('a1f1b2c3-0001-4aaa-8bbb-000000000001', 'a1f1b2c3-0002-4aaa-8bbb-000000000002', 'a1f1b2c3-0003-4aaa-8bbb-000000000003')`);
        await queryRunner.query(`DELETE FROM "traffic_segments" WHERE "id" IN ('b2c3d4e5-0001-4bbb-9ccc-111111111111', 'b2c3d4e5-0002-4bbb-9ccc-222222222222', 'b2c3d4e5-0003-4bbb-9ccc-333333333333', 'b2c3d4e5-0004-4bbb-9ccc-444444444444', 'b2c3d4e5-0005-4bbb-9ccc-555555555555')`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_traffic_segments_coordinates"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_flood_zones_coordinates"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "traffic_segments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "flood_zones"`);
    }
}
