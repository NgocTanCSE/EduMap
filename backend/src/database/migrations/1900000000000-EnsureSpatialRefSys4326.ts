import { MigrationInterface, QueryRunner } from 'typeorm';
export class EnsureSpatialRefSys43261900000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
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
    }
}
