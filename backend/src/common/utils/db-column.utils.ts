/**
 * TypeORM column-option helpers for DDL that must differ between PostgreSQL
 * (production) and SQLite (lightweight / migration DB).
 *
 * WHY THIS EXISTS
 * Historically every entity decorator inlined the same `process.env.DB_TYPE`
 * ternary, e.g.:
 *
 *   @Column({ type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'json' })
 *   @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime' })
 *   @Column({ type: process.env.DB_TYPE === 'postgres' ? 'enum' : 'text', enum: X })
 *
 * …and for geographic columns the ternary was NESTED, re-evaluating the env
 * var up to three times inside a single decorator:
 *
 *   type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json',
 *   ...(process.env.DB_TYPE === 'postgres'
 *       ? { ...(process.env.DB_TYPE === 'postgres'
 *           ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {})
 *           , srid: 4326 } : {}) } : {})
 *
 * A typo in one check silently changed only *part* of a column definition,
 * which is exactly the kind of drift bug that is invisible until schema-sync
 * time and impossible to unit-test. These helpers read the env var ONCE at
 * module load and return an options object, so the intent is explicit and
 * every column follows the same, tested path.
 *
 * MIGRATION: there are ~43 entity files using the inline ternary. With this
 * helper in place, converting each one is a mechanical, low-risk substitution.
 * The geography/geometry variants (Point, Polygon, LineString, Geometry) are
 * all covered by {@link geoColumn}.
 */

const isPostgres = process.env.DB_TYPE === 'postgres';

/** Native PostGIS geography(Point, 4326) on Postgres, JSON on SQLite. */
export function geoPointColumn(): Record<string, unknown> {
  return isPostgres
    ? { type: 'geography', spatialFeatureType: 'Point', srid: 4326 }
    : { type: 'json' };
}

/**
 * Native PostGIS geography with a configurable feature type
 * ('Point' | 'Polygon' | 'LineString' | 'Geometry'). Use this for the
 * geometry/geometry(Polygon)/... variants found in the codebase.
 */
type GeoFeature = 'Point' | 'Polygon' | 'LineString' | 'Geometry';
export function geoColumn(featureType: GeoFeature = 'Point'): Record<string, unknown> {
  return isPostgres
    ? { type: 'geography', spatialFeatureType: featureType, srid: 4326 }
    : { type: 'json' };
}

/** JSONB on Postgres (supports querying / array indexing), JSON on SQLite. */
export function jsonColumn(nullable = false): Record<string, unknown> {
  return { type: isPostgres ? 'jsonb' : 'json', nullable };
}

/**
 * Datetime column. The Postgres driver has NO native `datetime` type and
 * crashes bootstrap if you use it, so we always route through here:
 * `timestamp` (or `timestamp with time zone`) on Postgres, `datetime` on SQLite.
 */
export function datetimeColumn(
  nullable = false,
  withTimezone = false,
): Record<string, unknown> {
  return {
    type: isPostgres ? (withTimezone ? 'timestamp with time zone' : 'timestamp') : 'datetime',
    nullable,
  };
}

/**
 * ENUM column. Postgres supports native ENUM; SQLite stores it as TEXT and
 * relies on TypeORM's `enum` option for validation. Returns only the `type`
 * so callers can spread their own `enum` / `default` keys:
 *   @Column({ ...enumColumn(), enum: MyStatus, default: MyStatus.ACTIVE })
 */
export function enumColumn(): Record<string, unknown> {
  return { type: isPostgres ? 'enum' : 'text' };
}
