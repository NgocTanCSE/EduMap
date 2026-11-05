import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureSpatialRefSys43261900000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Supabase sometimes ships an empty spatial_ref_sys table, which makes
    // every ST_MakeEnvelope(..., 4326) / ST_Intersects call fail with
    // "Cannot find SRID (4326) in spatial_ref_sys".
    await queryRunner.query(`
      INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
      VALUES (4326, 'EPSG', 4326,
        'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
        '+proj=longlat +datum=WGS84 +no_defs'
      )
      ON CONFLICT (srid) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // no-op: keep SRID 4326
  }
}
