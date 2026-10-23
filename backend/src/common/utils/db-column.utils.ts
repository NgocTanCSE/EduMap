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

/**
 * Array-of-strings column. Postgres uses native `text[]`; SQLite has no array
 * type at all (TypeORM throws DataTypeNotSupportedError for `array: true`), so
 * we store a JSON-encoded string and convert in a transformer.
 *
 * Existing rows in the bundled SQLite DB already hold JSON (`[]`, `["a"]`),
 * so the transformer keeps that format instead of switching to `simple-array`
 * (comma-separated), which would mis-read existing data.
 *
 *   @Column(textArrayColumn())
 *   skills: string[];
 */
export function textArrayColumn(): Record<string, unknown> {
  if (isPostgres) {
    return { type: 'text', array: true, default: '{}' };
  }
  return {
    type: 'text',
    default: '[]',
    transformer: {
      // Return type is `any`: this repo compiles with strictNullChecks=false,
      // so `value == null` does not narrow the true branch to null/undefined.
      to: (value: string[] | string | null | undefined): any => {
        // Already serialized (e.g. re-saving an entity that went through a
        // previous hydrate/write cycle) — pass through unchanged instead of
        // double-JSON-encoding into `"[\x22a\x22]"`.
        if (typeof value === 'string') return value;
        return value == null ? value : JSON.stringify(value);
      },
      from: (value: string | string[] | null | undefined): string[] => {
        if (value == null || value === '') return [];
        // TypeORM applies `from()` a second time on INSERT-generated maps
        // (SubjectExecutor.executeInsertOperations hydrates the returned
        // values through prepareHydratedValue). That feeds the already
        // transformed Array back into this transformer; JSON.parse(Array)
        // then throws SyntaxError and the catch calls `.split` on an Array
        // → "value.split is not a function" (broke POST /api/auth/google).
        if (Array.isArray(value)) return value;
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        try {
          const parsed = JSON.parse(str);
          return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          return str.split(',').map((v) => v.trim()).filter(Boolean);
        }
      },
    },
  };
}
