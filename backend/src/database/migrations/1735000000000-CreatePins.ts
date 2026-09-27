import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePins1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50) DEFAULT 'event',
        poster_name VARCHAR(255),
        posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        location GEOMETRY(Geometry, 4326),
        city VARCHAR(255),
        district VARCHAR(255),
        province VARCHAR(255),
        status VARCHAR(100) DEFAULT 'pending',
        photos JSONB,
        tags JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT chk_pins_type CHECK (type IN ('event','ad','green','book','wifi','note','other')),
        CONSTRAINT chk_pins_status CHECK (status IN ('pending','published','rejected'))
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_pins_location ON pins USING GIST(location);`);
    await queryRunner.query(`CREATE INDEX idx_pins_posted_by ON pins(posted_by);`);
    await queryRunner.query(`CREATE INDEX idx_pins_status_type ON pins(status, type);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pins CASCADE;`);
  }
}
