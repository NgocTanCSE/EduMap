import { Logger } from '@nestjs/common';
import * as fs from 'fs';

/**
 * SQLite bootstrap / schema self-healing for HF Spaces.
 *
 * WHY THIS EXISTS
 * On HF Spaces the backend runs against a *pre-built* SQLite file
 * (`DB_SQLITE_PATH=/app/frontend/public/edumap.db`) with
 * `DB_SYNC=false`, so TypeORM never creates or alters anything. That file can
 * lag behind the entities (it still carried `role_id` and camelCase auth
 * columns after the CA02 role refactor), which makes every user query fail.
 *
 * This runs once at boot, before Nest/TypeORM initialize, and is idempotent:
 *   • adds `users.role` and backfills it from `role_id` when missing
 *   • renames legacy camelCase auth columns to the snake_case names the
 *     entities expect
 *   • adds `comments.status`, required by AI-only comment moderation
 *
 * It is a no-op on Postgres, in-memory DBs, and DBs that are already current.
 */

/** roles.id → UserRole, matching backend/src/database/migrations/1830000000000-CreateUserRoleEnum.ts */
const ROLE_BY_ROLE_ID: Record<number, string> = {
  1: 'super_admin',
  2: 'admin',
  3: 'moderator',
  4: 'school_rep',
  5: 'university_rep',
  6: 'employer',          // was 'business_partner' — deduped from PARTNER
  7: 'donor',             // was 'sponsor'
  8: 'teacher',
  9: 'mentor',
  10: 'community_coord',  // was 'volunteer'
  11: 'student',
  12: 'guest',            // was shared by PARENT+SUPPORT_STAFF — now just GUEST
  13: 'parent',           // NEW — was duplicate 'guest'
  14: 'support_staff',    // NEW — was duplicate 'guest'
  15: 'partner',          // NEW — was duplicate 'business_partner'
};

/** Legacy role string → canonical enum value (for normalizing existing rows). */
const ROLE_VALUE_NORMALIZATION: Record<string, string> = {
  'business_partner': 'employer',  // can't distinguish EMPLOYER vs PARTNER in old data
  'sponsor': 'donor',
  'volunteer': 'community_coord',
};

/** Legacy camelCase column → snake_case column expected by the entities. */
const COLUMN_RENAMES: Array<[string, string]> = [
  ['twoFactorSecret', 'two_factor_secret'],
  ['isTwoFactorEnabled', 'is_two_factor_enabled'],
  ['refreshTokenHash', 'refresh_token_hash'],
];

/**
 * Curated `education_stats` rows (2022–2024, 4 metrics × 5 regions).
 * These are the same values as backend/src/database/migrations/seed_analytics.sql.
 * The shipped SQLite file had the table but zero rows, which left the
 * /analytics/trends page without any sector history on HF Spaces.
 */
const EDUCATION_STATS_SEED: Array<[string, string, string, number, number]> = [
  ['Đồng Nai', 'Đồng Nai', 'Enrollment Rate', 95.1279, 2022],
  ['Đồng Nai', 'Đồng Nai', 'Graduation Rate', 87.5835, 2022],
  ['Đồng Nai', 'Đồng Nai', 'STEM Lab Usage', 50.6888, 2022],
  ['Đồng Nai', 'Đồng Nai', 'Online Learning Adoption', 84.6484, 2022],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Enrollment Rate', 94.243, 2022],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Graduation Rate', 90.4361, 2022],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'STEM Lab Usage', 43.7362, 2022],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Online Learning Adoption', 63.901, 2022],
  ['Hà Nội', 'Hà Nội', 'Enrollment Rate', 92.7685, 2022],
  ['Hà Nội', 'Hà Nội', 'Graduation Rate', 94.7651, 2022],
  ['Hà Nội', 'Hà Nội', 'STEM Lab Usage', 83.7467, 2022],
  ['Hà Nội', 'Hà Nội', 'Online Learning Adoption', 94.9346, 2022],
  ['Đà Nẵng', 'Đà Nẵng', 'Enrollment Rate', 96.6091, 2022],
  ['Đà Nẵng', 'Đà Nẵng', 'Graduation Rate', 90.5654, 2022],
  ['Đà Nẵng', 'Đà Nẵng', 'STEM Lab Usage', 76.0051, 2022],
  ['Đà Nẵng', 'Đà Nẵng', 'Online Learning Adoption', 85.7226, 2022],
  ['Cần Thơ', 'Cần Thơ', 'Enrollment Rate', 93.8105, 2022],
  ['Cần Thơ', 'Cần Thơ', 'Graduation Rate', 89.9947, 2022],
  ['Cần Thơ', 'Cần Thơ', 'STEM Lab Usage', 78.2472, 2022],
  ['Cần Thơ', 'Cần Thơ', 'Online Learning Adoption', 60.7387, 2022],
  ['Đồng Nai', 'Đồng Nai', 'Enrollment Rate', 95.2716, 2023],
  ['Đồng Nai', 'Đồng Nai', 'Graduation Rate', 87.3639, 2023],
  ['Đồng Nai', 'Đồng Nai', 'STEM Lab Usage', 69.0702, 2023],
  ['Đồng Nai', 'Đồng Nai', 'Online Learning Adoption', 70.2208, 2023],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Enrollment Rate', 95.3398, 2023],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Graduation Rate', 88.7629, 2023],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'STEM Lab Usage', 59.7057, 2023],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Online Learning Adoption', 84.3238, 2023],
  ['Hà Nội', 'Hà Nội', 'Enrollment Rate', 95.7308, 2023],
  ['Hà Nội', 'Hà Nội', 'Graduation Rate', 91.4582, 2023],
  ['Hà Nội', 'Hà Nội', 'STEM Lab Usage', 50.5632, 2023],
  ['Hà Nội', 'Hà Nội', 'Online Learning Adoption', 60.5325, 2023],
  ['Đà Nẵng', 'Đà Nẵng', 'Enrollment Rate', 96.9905, 2023],
  ['Đà Nẵng', 'Đà Nẵng', 'Graduation Rate', 91.3696, 2023],
  ['Đà Nẵng', 'Đà Nẵng', 'STEM Lab Usage', 49.656, 2023],
  ['Đà Nẵng', 'Đà Nẵng', 'Online Learning Adoption', 71.5389, 2023],
  ['Cần Thơ', 'Cần Thơ', 'Enrollment Rate', 94.7292, 2023],
  ['Cần Thơ', 'Cần Thơ', 'Graduation Rate', 92.1228, 2023],
  ['Cần Thơ', 'Cần Thơ', 'STEM Lab Usage', 51.2661, 2023],
  ['Cần Thơ', 'Cần Thơ', 'Online Learning Adoption', 81.0341, 2023],
  ['Đồng Nai', 'Đồng Nai', 'Enrollment Rate', 94.2058, 2024],
  ['Đồng Nai', 'Đồng Nai', 'Graduation Rate', 92.4646, 2024],
  ['Đồng Nai', 'Đồng Nai', 'STEM Lab Usage', 88.7626, 2024],
  ['Đồng Nai', 'Đồng Nai', 'Online Learning Adoption', 76.5467, 2024],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Enrollment Rate', 95.2674, 2024],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Graduation Rate', 93.3161, 2024],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'STEM Lab Usage', 80.385, 2024],
  ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Online Learning Adoption', 90.4985, 2024],
  ['Hà Nội', 'Hà Nội', 'Enrollment Rate', 92.1053, 2024],
  ['Hà Nội', 'Hà Nội', 'Graduation Rate', 88.4934, 2024],
  ['Hà Nội', 'Hà Nội', 'STEM Lab Usage', 41.5727, 2024],
  ['Hà Nội', 'Hà Nội', 'Online Learning Adoption', 65.332, 2024],
  ['Đà Nẵng', 'Đà Nẵng', 'Enrollment Rate', 95.2285, 2024],
  ['Đà Nẵng', 'Đà Nẵng', 'Graduation Rate', 85.6427, 2024],
  ['Đà Nẵng', 'Đà Nẵng', 'STEM Lab Usage', 68.9565, 2024],
  ['Đà Nẵng', 'Đà Nẵng', 'Online Learning Adoption', 85.6511, 2024],
  ['Cần Thơ', 'Cần Thơ', 'Enrollment Rate', 96.1942, 2024],
  ['Cần Thơ', 'Cần Thơ', 'Graduation Rate', 94.8539, 2024],
  ['Cần Thơ', 'Cần Thơ', 'STEM Lab Usage', 49.1604, 2024],
  ['Cần Thơ', 'Cần Thơ', 'Online Learning Adoption', 79.9747, 2024],
];

function openDb(path: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3');
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, (err: Error | null) =>
      err ? reject(err) : resolve(db),
    );
  });
}

function exec(db: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) =>
    db.exec(sql, (err: Error | null) => (err ? reject(err) : resolve())),
  );
}

function all(db: any, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) =>
    db.all(sql, (err: Error | null, rows: any[]) => (err ? reject(err) : resolve(rows || []))),
  );
}

function run(db: any, sql: string): Promise<{ changes: number }> {
  return new Promise((resolve, reject) =>
    db.run(sql, function (this: any, err: Error | null) {
      return err ? reject(err) : resolve({ changes: this?.changes ?? 0 });
    }),
  );
}

function close(db: any): Promise<void> {
  return new Promise((resolve) => db.close(() => resolve()));
}

export async function ensureSqliteSchema(): Promise<void> {
  if (process.env.DB_TYPE === 'postgres') return;

  const dbPath = process.env.DB_SQLITE_PATH || ':memory:';
  if (dbPath === ':memory:' || !fs.existsSync(dbPath)) return;

  const logger = new Logger('SqliteBootstrap');
  let db: any;

  try {
    db = await openDb(dbPath);

    const tables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    if (tables.length === 0) return;

    const columns: any[] = await all(db, 'PRAGMA table_info(users)');
    const names = new Set<string>(columns.map((c) => String(c.name)));
    const changes: string[] = [];

    // 1. Legacy camelCase → snake_case (only when the new name is absent).
    for (const [from, to] of COLUMN_RENAMES) {
      if (names.has(from) && !names.has(to)) {
        await exec(db, `ALTER TABLE users RENAME COLUMN "${from}" TO "${to}"`);
        names.delete(from);
        names.add(to);
        changes.push(`${from} → ${to}`);
      }
    }

    // 2. `role` column (CA02). Postgres gets it from a migration; SQLite needs it here.
    let roleWasAdded = false;
    if (!names.has('role')) {
      await exec(db, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'");
      names.add('role');
      roleWasAdded = true;
      changes.push('added role');
    }

    if (names.has('role_id')) {
      const cases = Object.entries(ROLE_BY_ROLE_ID)
        .map(([id, role]) => `WHEN ${Number(id)} THEN '${role}'`)
        .join(' ');
      // A freshly added column is 'student' for every row, so backfill all of
      // them once. On later boots only fill genuinely empty values, so manual
      // role changes are never overwritten.
      const where = roleWasAdded ? '' : "WHERE role IS NULL OR role = ''";
      const result = await run(
        db,
        `UPDATE users SET role = CASE CAST(role_id AS INTEGER) ${cases} ELSE 'student' END ${where}`,
      );
      if (result.changes > 0) changes.push(`backfilled ${result.changes} role(s) from role_id`);
    }

    // 2b. Normalize legacy role *string* values to the new canonical enum values.
    // This handles rows that already had a `role` column with old string values
    // (e.g. 'business_partner' → 'employer', 'sponsor' → 'donor', 'volunteer' → 'community_coord')
    // from a previous bootstrap run with the old enum. New role_id backfills
    // (step 2) already write the new values, so this only touches old rows.
    if (names.has('role')) {
      for (const [oldVal, newVal] of Object.entries(ROLE_VALUE_NORMALIZATION)) {
        const result = await run(
          db,
          `UPDATE users SET role = '${newVal}' WHERE role = '${oldVal}'`,
        );
        if (result.changes > 0) changes.push(`normalized ${result.changes} role(s) from '${oldVal}' to '${newVal}'`);
      }
    }

    // 3. `comments.status` (AI-only moderation). The shipped SQLite file predates
    // the entity column, so inserting a comment fails without this heal.
    const commentTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='comments'",
    );
    if (commentTables.length > 0) {
      const commentColumns: any[] = await all(db, 'PRAGMA table_info(comments)');
      const commentNames = new Set<string>(commentColumns.map((c) => String(c.name)));
      if (!commentNames.has('status')) {
        await exec(db, "ALTER TABLE comments ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
        changes.push('added comments.status');
      }
    }

    // 4. `map_points.is_fixed` — cờ điểm cố định/chính thức (trường, lab, thư viện...).
    const mapPointTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='map_points'",
    );
    if (mapPointTables.length > 0) {
      const mapPointColumns: any[] = await all(db, 'PRAGMA table_info(map_points)');
      const mapPointNames = new Set<string>(mapPointColumns.map((c) => String(c.name)));
      if (!mapPointNames.has('is_fixed')) {
        await exec(db, "ALTER TABLE map_points ADD COLUMN is_fixed INTEGER NOT NULL DEFAULT 0");
        changes.push('added map_points.is_fixed');
      }
    }

    // 5. Seed `education_stats` when the shipped DB has the table but no rows.
    // The /analytics/trends page groups these rows by metric_type/year; without
    // them the AI service returns an empty sector list on HF Spaces.
    const educationTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='education_stats'",
    );
    if (educationTables.length > 0) {
      const countRows: any[] = await all(db, 'SELECT COUNT(*) AS count FROM education_stats');
      if (Number(countRows[0]?.count || 0) === 0) {
        const values = EDUCATION_STATS_SEED.map(
          ([region, province, metricType, metricValue, year]) =>
            `('${region}', '${province}', '${metricType}', ${metricValue}, ${year}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ).join(',\n');
        await exec(
          db,
          `INSERT INTO education_stats (region, province, metric_type, metric_value, year, created_at, updated_at) VALUES ${values}`,
        );
        changes.push(`seeded ${EDUCATION_STATS_SEED.length} education_stats row(s)`);
      }
    }

    // 6. `chat_histories` — AI chat persistence. The shipped SQLite file does
    // not contain this table, so /api/ai/history silently returned [] and the
    // analytics count threw "no such table", taking the whole trends endpoint
    // down with a 503.
    const chatTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='chat_histories'",
    );
    if (chatTables.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS chat_histories (
          id varchar PRIMARY KEY NOT NULL,
          user_id varchar,
          message text NOT NULL,
          response text NOT NULL,
          context text,
          created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      );
      changes.push('created chat_histories');
    }

    if (changes.length > 0) {
      logger.log(`SQLite schema updated (${dbPath}): ${changes.join(', ')}`);
    }
  } catch (error: any) {
    // Never block boot on a best-effort heal — surface it loudly instead.
    logger.error(`SQLite bootstrap failed (${dbPath}): ${error?.message || error}`);
  } finally {
    if (db) await close(db);
  }
}
