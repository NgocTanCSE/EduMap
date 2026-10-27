import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MIGRATION: Add featured-pin geo columns to feature tables.
 *
 * These columns let MapService.getFeaturedPins() aggregate pins from every
 * feature table (stem_labs, green_challenges, summer_campaigns,
 * donation_campaigns, shared_items, business_profiles) so they all appear on
 * the interactive map as "ghim" with direct links to their feature pages.
 * On SQLite the schema healing is handled by sqlite-bootstrap.ts; this migration
 * is for the Postgres production path (DB_SYNC=false).
 */
export class AddFeaturedPinGeoColumns1850000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // green_challenges: lat, lng, address
    const greenCols = await queryRunner.getTable('green_challenges');
    if (!greenCols!.columns.find((c) => c.name === 'lat')) {
      await queryRunner.query(`ALTER TABLE "green_challenges" ADD COLUMN "lat" numeric(10,8)`);
    }
    if (!greenCols!.columns.find((c) => c.name === 'lng')) {
      await queryRunner.query(`ALTER TABLE "green_challenges" ADD COLUMN "lng" numeric(11,8)`);
    }
    if (!greenCols!.columns.find((c) => c.name === 'address')) {
      await queryRunner.query(`ALTER TABLE "green_challenges" ADD COLUMN "address" TEXT`);
    }

    // summer_campaigns: lat, lng
    const summerCols = await queryRunner.getTable('summer_campaigns');
    if (summerCols && !summerCols.columns.find((c) => c.name === 'lat')) {
      await queryRunner.query(`ALTER TABLE "summer_campaigns" ADD COLUMN "lat" numeric(10,8)`);
    }
    if (summerCols && !summerCols.columns.find((c) => c.name === 'lng')) {
      await queryRunner.query(`ALTER TABLE "summer_campaigns" ADD COLUMN "lng" numeric(11,8)`);
    }

    // donation_campaigns: address (location_point already exists)
    const donateCols = await queryRunner.getTable('donation_campaigns');
    if (donateCols && !donateCols.columns.find((c) => c.name === 'address')) {
      await queryRunner.query(`ALTER TABLE "donation_campaigns" ADD COLUMN "address" TEXT`);
    }

    // shared_items: lat, lng, address
    const sharedCols = await queryRunner.getTable('shared_items');
    if (sharedCols && !sharedCols.columns.find((c) => c.name === 'lat')) {
      await queryRunner.query(`ALTER TABLE "shared_items" ADD COLUMN "lat" numeric(10,8)`);
    }
    if (sharedCols && !sharedCols.columns.find((c) => c.name === 'lng')) {
      await queryRunner.query(`ALTER TABLE "shared_items" ADD COLUMN "lng" numeric(11,8)`);
    }
    if (sharedCols && !sharedCols.columns.find((c) => c.name === 'address')) {
      await queryRunner.query(`ALTER TABLE "shared_items" ADD COLUMN "address" TEXT`);
    }

    // business_profiles: lat, lng (address already exists)
    const bizCols = await queryRunner.getTable('business_profiles');
    if (bizCols && !bizCols.columns.find((c) => c.name === 'lat')) {
      await queryRunner.query(`ALTER TABLE "business_profiles" ADD COLUMN "lat" numeric(10,8)`);
    }
    if (bizCols && !bizCols.columns.find((c) => c.name === 'lng')) {
      await queryRunner.query(`ALTER TABLE "business_profiles" ADD COLUMN "lng" numeric(11,8)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversible only for the columns we added (not the pre-existing ones).
    const dropIfExist = async (table: string, col: string) => {
      const t = await queryRunner.getTable(table);
      if (t && t.columns.find((c) => c.name === col)) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}"`);
      }
    };
    await dropIfExist('green_challenges', 'lat');
    await dropIfExist('green_challenges', 'lng');
    await dropIfExist('green_challenges', 'address');
    await dropIfExist('summer_campaigns', 'lat');
    await dropIfExist('summer_campaigns', 'lng');
    await dropIfExist('donation_campaigns', 'address');
    await dropIfExist('shared_items', 'lat');
    await dropIfExist('shared_items', 'lng');
    await dropIfExist('shared_items', 'address');
    await dropIfExist('business_profiles', 'lat');
    await dropIfExist('business_profiles', 'lng');
  }
}
