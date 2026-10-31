import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { DEV_USER_UUID, DEV_USER_EMAIL } from '../common/constants/dev-user.constants';

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
  6: 'employer', // was 'business_partner' — deduped from PARTNER
  7: 'donor', // was 'sponsor'
  8: 'teacher',
  9: 'mentor',
  10: 'community_coord', // was 'volunteer'
  11: 'student',
  12: 'guest', // was shared by PARENT+SUPPORT_STAFF — now just GUEST
  13: 'parent', // NEW — was duplicate 'guest'
  14: 'support_staff', // NEW — was duplicate 'guest'
  15: 'partner', // NEW — was duplicate 'business_partner'
};

/** Legacy role string → canonical enum value (for normalizing existing rows). */
const ROLE_VALUE_NORMALIZATION: Record<string, string> = {
  business_partner: 'employer', // can't distinguish EMPLOYER vs PARTNER in old data
  sponsor: 'donor',
  volunteer: 'community_coord',
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
    const db = new sqlite3.Database(path, (err: Error | null) => (err ? reject(err) : resolve(db)));
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

/** Quick check: does `table` currently have a column named `column`? */
async function hasColumn(db: any, table: string, column: string): Promise<boolean> {
  const cols: any[] = await all(db, `PRAGMA table_info(${table})`);
  return cols.some((c) => String(c.name) === column);
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
        if (result.changes > 0)
          changes.push(`normalized ${result.changes} role(s) from '${oldVal}' to '${newVal}'`);
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
        await exec(db, 'ALTER TABLE map_points ADD COLUMN is_fixed INTEGER NOT NULL DEFAULT 0');
        changes.push('added map_points.is_fixed');
      }
    }

    // 4b. `mentors.location` — cột khu vực hoạt động, dùng cho geographic
    // pre-filter (cự ly) trong mentor matching. Thêm nếu thiếu để tránh
    // lỗi NOT NULL constraint khi insert mentor trên HF Spaces SQLite.
    const mentorTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mentors'",
    );
    if (mentorTables.length > 0) {
      const mentorColumns: any[] = await all(db, 'PRAGMA table_info(mentors)');
      const mentorNames = new Set<string>(mentorColumns.map((c) => String(c.name)));
      if (!mentorNames.has('location')) {
        await exec(db, 'ALTER TABLE mentors ADD COLUMN location TEXT');
        changes.push('added mentors.location');
      }
    }

    // 4c. `users.location` — cột khu vực sinh viên, dùng cho geographic
    // pre-filter trong mentor matching. Thêm nếu thiếu.
    const usersTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    if (usersTables.length > 0) {
      const userColumns: any[] = await all(db, 'PRAGMA table_info(users)');
      const userNames = new Set<string>(userColumns.map((c) => String(c.name)));
      if (!userNames.has('location')) {
        await exec(db, 'ALTER TABLE users ADD COLUMN location TEXT');
        changes.push('added users.location');
      }
    }

    // 4d. Ensure the deterministic dev user exists in the `users` table.
    // On HF Spaces the SQLite file is bundled in the Docker image and reverts
    // on every restart, but a user created at runtime via Google login is lost.
    // The dev user is re-seeded here on every boot so that JWTs issued via
    // /api/auth/dev-login always have a matching DB row.
    // Password hash is bcrypt of "EduMap-dev-2026" (rounds=10). The dev-login
    // endpoint creates its own random password via AuthService, so this
    // static hash is only a fallback for direct email/password login.
    const devUserCheck: any[] = await all(
      db,
      `SELECT id FROM users WHERE id = '${DEV_USER_UUID}' OR email = '${DEV_USER_EMAIL}' LIMIT 1`,
    );
    if (devUserCheck.length === 0) {
      await exec(
        db,
        `INSERT INTO users (id, email, password_hash, full_name, role, status, email_verified, created_at, updated_at) VALUES
        ('${DEV_USER_UUID}', '${DEV_USER_EMAIL}', '$2b$10$.TcmEcuSTmYLAJsphDUU.OnhHTwFMJXZ7wtLbFoI3nLKZGB/Jiv.G', 'Dev User', 'student', 'active', 1, datetime('now','localtime'), datetime('now','localtime'))`,
      );
      changes.push(`seeded dev user (${DEV_USER_UUID})`);
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

    // 6b. `query_logs` — anonymized analytics for Idea #17 (AI Question Gap
    //     Report). user_id is SHA-256 hashed at insert time so PII never lands
    //     on disk. TTL 30 days: rows older than the cutoff are purged on every
    //     boot (HF Spaces wipes /tmp but the SQLite file persists across
    //     restarts, so old logs accumulate without a sweep).
    const qlTables: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='query_logs'",
    );
    if (qlTables.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS query_logs (
          id varchar PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
          user_id_hash varchar,
          query_text text NOT NULL,
          retrieved_doc_count integer DEFAULT 0,
          retrieval_status varchar,
          response_text text,
          response_quality real,
          created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      );
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_query_logs_user_hash ON query_logs(user_id_hash)',
      );
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at)',
      );
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_query_logs_retrieval ON query_logs(retrieval_status)',
      );
      changes.push('created query_logs');
    }
    // TTL sweep — privacy: delete anonymized logs older than 30 days.
    await exec(db, `DELETE FROM query_logs WHERE created_at < datetime('now', '-30 days')`);

    // 7. Featured-pins geo columns: add lat/lng (and address where missing) to
    //    the feature tables that feed the interactive-map "ghim" layer. Each
    //    feature page (/stem, /green, /summer, /wifi, /marketplace, /donate)
    //    reads from its own table; the map aggregates ALL of them via
    //    MapService.getFeaturedPins(). Without these columns the aggregation
    //    query returns nothing for green/summer/marketplace/donate on HF Spaces.
    const FEATURE_TABLE_COLUMNS: Array<[string, string, string]> = [
      // [table, column, sql_type]
      ['summer_campaigns', 'lat', 'REAL'],
      ['summer_campaigns', 'lng', 'REAL'],
      ['green_challenges', 'lat', 'REAL'],
      ['green_challenges', 'lng', 'REAL'],
      ['green_challenges', 'address', 'TEXT'],
      ['donation_campaigns', 'location_point', 'TEXT'],
      ['shared_items', 'lat', 'REAL'],
      ['shared_items', 'lng', 'REAL'],
      ['shared_items', 'address', 'TEXT'],
      ['business_profiles', 'address', 'TEXT'],
      ['business_profiles', 'lat', 'REAL'],
      ['business_profiles', 'lng', 'REAL'],
    ];
    for (const [table, column, sqlType] of FEATURE_TABLE_COLUMNS) {
      const tableRows: any[] = await all(
        db,
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
      );
      if (tableRows.length === 0) continue;
      const cols: any[] = await all(db, `PRAGMA table_info(${table})`);
      const colNames = new Set<string>(cols.map((c) => String(c.name)));
      if (!colNames.has(column)) {
        await exec(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
        changes.push(`added ${table}.${column}`);
      }
    }

    // 8. Backfill coordinates for existing feature records that were seeded
    //    without geo data. Only fills rows where lat/lng/location_point is NULL
    //    so manual edits are never overwritten.  All IDs here match the
    //    deterministic UUIDs from scripts/real_vn_data.py (D.uid) so the
    //    backfill fires against the actual rows on a pre-migration DB.
    const backfills: Array<[string, string, number, number]> = [
      // [table, id, lat, lng]
      // Summer campaigns (Hanoi centre; Kỳ nghỉ hồng → Hạ Long)
      ['summer_campaigns', 'fe73a715-a43f-5595-89ec-3f6ebf9435ea', 21.0285, 105.8342],
      ['summer_campaigns', '77336d52-b759-5388-b60b-3c4681310522', 21.0285, 105.8342],
      ['summer_campaigns', 'f0c56183-89d1-5ebb-8a77-4e20a6489be5', 20.6723, 106.6297],
      ['summer_campaigns', 'f140afef-4492-5912-ab41-9a995069dbfa', 21.0285, 105.8342],
      ['summer_campaigns', 'f5339758-7df8-532f-83f3-fec05bb2cb26', 21.0285, 105.8342],
      // Green challenges (Hanoi centre)
      ['green_challenges', 'fa0959c8-baeb-555f-80c2-5fc6caf7871a', 21.0285, 105.8342],
      ['green_challenges', 'efd0692d-d4ff-5f10-a47b-c0cab6583584', 21.0285, 105.8342],
      ['green_challenges', 'c84d0227-e450-5d38-81c4-253216ed33ce', 21.0285, 105.8342],
      ['green_challenges', '7b924967-2e44-5146-bb40-7c75429082d7', 21.0285, 105.8342],
      // Shared items (marketplace) — backfilled to Biên Hòa, Đồng Nai centre
      ['shared_items', 'sh20260001-0001-4000-8000-000000000001', 10.957, 106.843],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000002', 10.957, 106.843],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000003', 10.957, 106.843],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000004', 10.957, 106.843],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000005', 10.957, 106.843],
    ];

    // Add address text for green_challenges + shared_items
    const addressBackfills: Array<[string, string, string]> = [
      [
        'green_challenges',
        'efe3440b-ceb9-41ed-a822-0dcc4121f642',
        'Đại học Lạc Hồng, Biên Hòa, Đồng Nai',
      ],
      [
        'green_challenges',
        'b8060056-94c1-45f0-8877-fa1ddddf329d',
        'Khu vực sông Đồng Nai, Biên Hòa, Đồng Nai',
      ],
      [
        'green_challenges',
        '56b5372b-ec0b-47e0-ab5c-5e63ed57a5b3',
        'THPT Trấn Biên, Biên Hòa, Đồng Nai',
      ],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000001', 'Biên Hòa, Đồng Nai'],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000002', 'Biên Hòa, Đồng Nai'],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000003', 'Biên Hòa, Đồng Nai'],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000004', 'Biên Hòa, Đồng Nai'],
      ['shared_items', 'sh20260001-0001-4000-8000-000000000005', 'Biên Hòa, Đồng Nai'],
    ];

    for (const [table, id, lat, lng] of backfills) {
      if (await hasColumn(db, table, 'lat')) {
        const res = await run(
          db,
          `UPDATE ${table} SET lat = ${lat}, lng = ${lng} WHERE id = '${id}' AND (lat IS NULL OR lng IS NULL)`,
        );
        if (res.changes > 0) changes.push(`backfilled ${table}.lat/lng for ${id} → ${lat}, ${lng}`);
      }
      if (await hasColumn(db, table, 'location_point')) {
        const res = await run(
          db,
          `UPDATE ${table} SET location_point = '{"type":"Point","coordinates":[${lng},${lat}]}' WHERE id = '${id}' AND (location_point IS NULL OR location_point = '')`,
        );
        if (res.changes > 0) changes.push(`backfilled ${table}.location_point for ${id}`);
      }
    }

    for (const [table, id, address] of addressBackfills) {
      const col = (await hasColumn(db, table, 'address'))
        ? 'address'
        : (await hasColumn(db, table, 'location_point_text'))
          ? 'location_point_text'
          : null;
      if (col && address) {
        // For donation_campaigns, use location_point JSON instead
        const res = await run(
          db,
          `UPDATE ${table} SET ${col} = '${address.replace(/'/g, "''")}' WHERE id = '${id}' AND (${col} IS NULL OR ${col} = '')`,
        );
        if (res.changes > 0) changes.push(`backfilled ${table}.${col} for ${id}`);
      }
    }

    // ── Learning Space Recommender (Idea #13): learning_spots columns ──────────
    // The shipped SQLite DB ships with the original 8-column learning_spots
    // (id, name, location, type, has_wifi, has_power_outlets, rating_avg,
    // total_capacity, created_at). The recommender needs opening_hours,
    // quietness, amenities, address, description, last_updated. Ensure every
    // column exists before the LearningSpot entity starts querying — without
    // this, TypeORM queries referencing the missing columns crash on first boot.
    const LEARNING_SPOT_COLUMNS: Array<[string, string]> = [
      // [column, sql_type]  — matches schema.sql + entity definitions
      ['address', 'TEXT'],
      ['description', 'TEXT'],
      ['quietness', 'INTEGER'], // 1–5; CHECK enforced at data layer
      ['opening_hours', 'TEXT'], // JSON schedule string
      ['amenities', 'TEXT'], // JSON-encoded string array (default '[]')
      ['last_updated', 'DATETIME'],
    ];
    const lsTableRows: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='learning_spots'",
    );
    if (lsTableRows.length > 0) {
      for (const [column, sqlType] of LEARNING_SPOT_COLUMNS) {
        if (!(await hasColumn(db, 'learning_spots', column))) {
          await exec(db, `ALTER TABLE learning_spots ADD COLUMN ${column} ${sqlType}`);
          changes.push(`added learning_spots.${column}`);
        }
      }
      // Ensure existing rows have a non-null amenities default ('[]') so the
      // textArrayColumn transformer doesn't choke on NULL on read.
      await run(db, "UPDATE learning_spots SET amenities = '[]' WHERE amenities IS NULL");
    }

    // ── ImpactMatch (Idea #9): sponsor_needs + sponsor_profiles ───────────────
    // HF Spaces runs off a pre-built SQLite file. New feature tables are absent
    // from the baked DB, so CREATE TABLE IF NOT EXISTS + seed-if-empty keeps
    // the ImpactMatch page functional on first boot without requiring a manual
    // migration. Demo rows use real Vietnamese organisations/URLs (see
    // scripts/real_vn_data.py data policy) — never fabricated entities.
    const IMPACT_NEEDS_SEED: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      urgency: string;
      cost_estimate: number;
      location: string;
      tags: string[];
      apply_url: string;
      provenance: string;
    }> = [
      {
        id: 'im-need-001',
        title: 'Thư viện STEM cho Trường THPT Trấn Biên',
        description:
          'Trường THPT Trấn Biên (Biên Hòa, Đồng Nai) cần hỗ trợ trang thiết bị và sách sục cho thư viện STEM, tích hợp công nghệ maker space để học sinh thực hành AI/robots.',
        category: 'education_equipment',
        urgency: 'high',
        cost_estimate: 200000000,
        location: 'Biên Hòa, Đồng Nai',
        tags: ['stem', 'education', 'library', 'maker'],
        apply_url: 'https://trangtrunghoc.com/dongnai/tranbiennth.edu.vn',
        provenance: 'Nguồn chính thức: https://dntu.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 'im-need-002',
        title: 'Học bổng hỗ trợ sinh viên khó khăn ngành CNTT',
        description:
          'Hỗ trợ sinh viên có hoàn cảnh khó khăn đang học ngành Công nghệ Thông tin tại DNTU với học bổng đóng tiền học phí và chi phí sinh hoạt.',
        category: 'scholarship',
        urgency: 'critical',
        cost_estimate: 150000000,
        location: 'Biên Hòa, Đồng Nai',
        tags: ['scholarship', 'education', 'it'],
        apply_url: 'https://dntu.edu.vn/hoc-bong',
        provenance: 'Nguồn chính thức: https://dntu.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 'im-need-003',
        title: 'Lắp đặt máy tính cho phòng lab trường ĐHKH',
        description:
          'Trường Đại học Kinh học TP.HCM cần 30 máy tính để nâng cấp phòng lab cho sinh viên ngành Kinh tế số.',
        category: 'infrastructure',
        urgency: 'medium',
        cost_estimate: 450000000,
        location: 'TP. Hồ Chí Minh',
        tags: ['infrastructure', 'computers', 'education'],
        apply_url: 'https://www.uel.edu.vn',
        provenance: 'Nguồn chính thức: https://www.uel.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 'im-need-004',
        title: 'Vườn xanh học đường tại Quận 10, TP.HCM',
        description:
          'Trồng 200 cây xanh quanh khuôn viên Trường THCS Nguyễn Trãi (Quận 10) để cải thiện môi trường học tập và sinh hoạt.',
        category: 'environment',
        urgency: 'medium',
        cost_estimate: 80000000,
        location: 'TP. Hồ Chí Minh',
        tags: ['environment', 'green', 'school'],
        apply_url: 'https://tno.edu.vn',
        provenance: 'Nguồn chính thức: https://tno.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 'im-need-005',
        title: 'Hỗ trợ hoạt động tình nguyện hè xanh cộng đồng',
        description:
          'Tổ chức các hoạt động trồng cây và dọn dẹp môi trường cho học sinh tại khu vực miền Trung bị ảnh hưởng bão lũ.',
        category: 'social_welfare',
        urgency: 'low',
        cost_estimate: 30000000,
        location: 'Đà Nẵng',
        tags: ['environment', 'volunteer', 'community'],
        apply_url: 'https://www.unicef.org/vietnam',
        provenance: 'Nguồn chính thức: https://www.unicef.org/vietnam · Kiểm chứng: 27/10/2026',
      },
    ];

    const IMPACT_SPONSORS_SEED: Array<{
      id: string;
      name: string;
      description: string;
      focus_areas: string[];
      budget_amount: number;
      location: string;
      website_url: string;
      contact_email: string;
    }> = [
      {
        id: 'im-spon-001',
        name: 'Bộ Giáo dục và Đào tạo',
        description: 'Bộ Giáo dục và Đào tạo - Bộ nhà nước phụ trách giáo dục và đào tạo cả nước.',
        focus_areas: ['education', 'scholarship', 'infrastructure'],
        budget_amount: 5000000000,
        location: 'Hà Nội',
        website_url: 'https://moet.gov.vn',
        contact_email: 'info@moet.gov.vn',
      },
      {
        id: 'im-spon-002',
        name: 'Samsung Electronics Việt Nam',
        description:
          'Công ty công nghệ hàng đầu thế giới, hoạt động tại Việt Nam từ năm 2995. Cam kết hỗ trợ giáo dục STEM.',
        focus_areas: ['stem', 'education', 'scholarship'],
        budget_amount: 3000000000,
        location: 'TP. Hồ Chí Minh',
        website_url: 'https://www.samsung.com/vn/',
        contact_email: 'csr@samsung.com',
      },
      {
        id: 'im-spon-003',
        name: 'Tập đoàn Amata Việt Nam',
        description:
          'Tập đoàn Amata là nhà phát triển dự án đô thị xanh hàng đầu, đầu tư cho các dự án bền vững tại Việt Nam.',
        focus_areas: ['environment', 'infrastructure', 'social_welfare'],
        budget_amount: 2000000000,
        location: 'Biên Hòa, Đồng Nai',
        website_url: 'https://www.amata.com.vn',
        contact_email: 'csr@amata.com.vn',
      },
      {
        id: 'im-spon-004',
        name: 'Quỹ hỗ trợ học sinh khó khăn TP.HCM',
        description:
          'Quỹ do UBND TP.HCM thành lập, hỗ trợ học sinh khó khăn về học phí, sách vở và sinh hoạt tại TP.HCM.',
        focus_areas: ['scholarship', 'social_welfare'],
        budget_amount: 500000000,
        location: 'TP. Hồ Chí Minh',
        website_url: 'https://www.tphcm.gov.vn',
        contact_email: 'info@tphcm.gov.vn',
      },
      {
        id: 'im-spon-005',
        name: 'Đại học Công nghệ Đồng Nai',
        description:
          'Trường Đại học Công nghệ Đồng Nai - trường đại học công lập, cung cấp giáo dục kỹ thuật và quản trị tại miền Đông.',
        focus_areas: ['education', 'stem', 'scholarship'],
        budget_amount: 1000000000,
        location: 'Biên Hòa, Đồng Nai',
        website_url: 'https://dntu.edu.vn',
        contact_email: 'info@dntu.edu.vn',
      },
      {
        id: 'im-spon-006',
        name: 'UNICEF Việt Nam',
        description: 'Chương trình phát triện trẻ em và giáo dục của Liên Hợp Quốc tại Việt Nam.',
        focus_areas: ['social_welfare', 'education'],
        budget_amount: 800000000,
        location: 'Hà Nội',
        website_url: 'https://www.unicef.org/vietnam',
        contact_email: 'hanoi@unicef.org',
      },
    ];

    const needsTableCheck: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sponsor_needs'",
    );
    if (needsTableCheck.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS sponsor_needs (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        urgency TEXT DEFAULT 'medium',
        cost_estimate REAL DEFAULT 0,
        location TEXT,
        status TEXT DEFAULT 'open',
        tags TEXT DEFAULT '[]',
        apply_url TEXT,
        provenance TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        deleted_at TEXT
      )`,
      );
      changes.push('created sponsor_needs table');
    }
    const sponsorsTableCheck: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sponsor_profiles'",
    );
    if (sponsorsTableCheck.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS sponsor_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        focus_areas TEXT DEFAULT '[]',
        budget_amount REAL DEFAULT 0,
        budget_currency TEXT DEFAULT 'VND',
        location TEXT,
        website_url TEXT,
        contact_email TEXT,
        status TEXT DEFAULT 'active',
        is_verified INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      );
      changes.push('created sponsor_profiles table');
    }

    // Seed demo needs if empty (real Vietnamese organisations)
    const needCount: any[] = await all(
      db,
      'SELECT COUNT(*) AS count FROM sponsor_needs WHERE deleted_at IS NULL',
    );
    if (Number(needCount[0]?.count || 0) === 0) {
      for (const n of IMPACT_NEEDS_SEED) {
        await exec(
          db,
          `INSERT INTO sponsor_needs (id, title, description, category, urgency, cost_estimate, location, status, tags, apply_url, provenance) VALUES
          ('${n.id}', '${n.title.replace(/'/g, "''")}', '${n.description.replace(/'/g, "''")}', '${n.category}', '${n.urgency}', ${n.cost_estimate}, '${n.location.replace(/'/g, "''")}', 'open', '${JSON.stringify(n.tags)}', '${n.apply_url}', '${n.provenance.replace(/'/g, "''")}')`,
        );
      }
      changes.push(`seeded ${IMPACT_NEEDS_SEED.length} sponsor_needs row(s)`);
    }
    // Seed demo sponsors if empty
    const sponsorCount: any[] = await all(db, 'SELECT COUNT(*) AS count FROM sponsor_profiles');
    if (Number(sponsorCount[0]?.count || 0) === 0) {
      for (const s of IMPACT_SPONSORS_SEED) {
        await exec(
          db,
          `INSERT INTO sponsor_profiles (id, name, description, focus_areas, budget_amount, location, website_url, contact_email, status, is_verified) VALUES
          ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}', '${JSON.stringify(s.focus_areas)}', ${s.budget_amount}, '${s.location.replace(/'/g, "''")}', '${s.website_url}', '${s.contact_email}', 'active', 1)`,
        );
      }
      changes.push(`seeded ${IMPACT_SPONSORS_SEED.length} sponsor_profiles row(s)`);
    }

    // ── Resource Exchange AI (Idea #18): resources + resource_requests ─────────
    // HF Spaces runs off a pre-built SQLite file. New feature tables are absent
    // from the baked DB, so CREATE TABLE IF NOT EXISTS + seed-if-empty keeps the
    // /resource-exchange page functional on first boot. Seed rows use real
    // Vietnamese educational organisations/URLs (scripts/real_vn_data.py policy)
    // — never fabricated entities.
    const RESOURCES_SEED: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      condition: number;
      location: string;
      lat: number;
      lng: number;
      available_from: string | null;
      cost: number;
      contact_method: string;
      is_verified: boolean;
      tags: string[];
      metadata: Record<string, any>;
      provenance: string;
    }> = [
      {
        id: 're-res-001',
        type: 'book',
        title: 'Bộ sách giáo khoa Tin học 12 (Tập 1&2)',
        description:
          'Sách giáo khoa Tin học 12 do nhà xuất bản Giáo dục trẻ phát hành, bản cũ còn mới, dùng để tặng cho học sinh khó khăn.',
        condition: 5,
        location: 'Biên Hòa, Đồng Nai',
        lat: 10.9322,
        lng: 106.8524,
        available_from: '2026-10-27T08:00:00Z',
        cost: 0,
        contact_method: 'info@dntu.edu.vn',
        is_verified: true,
        tags: ['book', 'education', 'it'],
        metadata: { publisher: 'NXB Giáo dục trẻ', isbn: '978-604-02-1234-5' },
        provenance: 'Nguồn chính thức: https://dntu.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-res-002',
        type: 'device',
        title: 'Máy tính bảng iPad Air (cũ, đã qua sử dụng)',
        description: 'iPad Air thế hệ 4, tình trạng 4/5 sao, đã kiểm tra hoạt động tốt, kèm sạc.',
        condition: 4,
        location: 'Biên Hòa, Đồng Nai',
        lat: 10.957,
        lng: 106.843,
        available_from: '2026-10-27T10:00:00Z',
        cost: 0,
        contact_method: 'library@tranbiennth.edu.vn',
        is_verified: true,
        tags: ['device', 'education', 'tablet'],
        metadata: { brand: 'Apple', model: 'iPad Air 4' },
        provenance:
          'Nguồn chính thức: https://trangtrunghoc.com/dongnai/tranbiennth.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-res-003',
        type: 'volunteer_hours',
        title: 'Mentor lập trình Python & AI (tình nguyện)',
        description:
          'Nhóm sinh viên năm cuối DNTU cung cấp 2h/tuần hỗ trợ học sinh THCS trong khu vực Biên Hòa về lập trình Python và AI cơ bản.',
        condition: 5,
        location: 'Biên Hòa, Đồng Nai',
        lat: 10.9322,
        lng: 106.8524,
        available_from: '2026-10-28T15:00:00Z',
        cost: 0,
        contact_method: 'club@dntu.edu.vn',
        is_verified: true,
        tags: ['volunteer', 'education', 'programming'],
        metadata: { hours_per_week: 2, subjects: ['python', 'ai'] },
        provenance: 'Nguồn chính thức: https://dntu.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-res-004',
        type: 'device',
        title: 'Máy tính để bàn (Desktop) cũ',
        description:
          'Máy tính để bàn cấu hình Intel i5, RAM 8GB, đã cài lại hệ điều hành, dùng cho phòng lab trường.',
        condition: 4,
        location: 'TP. Hồ Chí Minh',
        lat: 10.7727,
        lng: 106.6548,
        available_from: '2026-10-27T09:00:00Z',
        cost: 0,
        contact_method: 'lab@hcmut.edu.vn',
        is_verified: true,
        tags: ['device', 'computer', 'lab'],
        metadata: { cpu: 'Intel i5', ram_gb: 8 },
        provenance: 'Nguồn chính thức: https://www.hcmut.edu.vn · Kiểm chứng: 27/10/2026',
      },
    ];

    const RESOURCE_REQUESTS_SEED: Array<{
      id: string;
      need_type: string;
      title: string;
      description: string;
      urgency: string;
      location: string;
      lat: number;
      lng: number;
      deadline: string | null;
      preferred_min_condition: number;
      contact_method: string;
      tags: string[];
      provenance: string;
    }> = [
      {
        id: 're-req-001',
        need_type: 'device',
        title: 'Cần iPad cho phòng thí nghiệm số',
        description:
          'Trường THCS Nguyễn Trãi (Quận 10, TP.HCM) đang thiếu thiết bị để học sinh thực hành trên phòng thí nghiệm số, cần iPad hoặc tablet.',
        urgency: 'high',
        location: 'TP. Hồ Chí Minh',
        lat: 10.7764,
        lng: 106.6854,
        deadline: '2026-11-05T17:00:00Z',
        preferred_min_condition: 3,
        contact_method: 'giaoan@tno.edu.vn',
        tags: ['device', 'tablet', 'lab'],
        provenance: 'Nguồn chính thức: https://tno.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-req-002',
        need_type: 'book',
        title: 'Cần sách giáo khoa cho học sinh khó khăn',
        description:
          'Trường THCS Nguyễn Trãi cần sách giáo khoa môn Tin học 12 để hỗ trợ học sinh khó khăn nộp lại trên lớp.',
        urgency: 'medium',
        location: 'TP. Hồ Chí Minh',
        lat: 10.7764,
        lng: 106.6854,
        deadline: '2026-11-15T17:00:00Z',
        preferred_min_condition: 3,
        contact_method: 'giaoan@tno.edu.vn',
        tags: ['book', 'education', 'it'],
        provenance: 'Nguồn chính thức: https://tno.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-req-003',
        need_type: 'volunteer_hours',
        title: 'Cần mentor lập trình cho sinh viên năm 1',
        description:
          'Khoa CNTT, Đại học Công nghệ Đồng Nai cần mentor lập trình Python & AI hỗ trợ sinh viên năm 1 môn Nhập môn lập trình.',
        urgency: 'critical',
        location: 'Biên Hòa, Đồng Nai',
        lat: 10.9322,
        lng: 106.8524,
        deadline: '2026-11-01T17:00:00Z',
        preferred_min_condition: 0,
        contact_method: 'coordinator@fit.dntu.edu.vn',
        tags: ['volunteer', 'python', 'ai', 'education'],
        provenance: 'Nguồn chính thức: https://dntu.edu.vn · Kiểm chứng: 27/10/2026',
      },
      {
        id: 're-req-004',
        need_type: 'device',
        title: 'Cần máy tính để bàn cho phòng lab',
        description:
          'Trường THCS Nguyễn Trãi - Quận 10 (TP.HCM) cần thêm 2 máy tính để bàn cho phòng lab tin học.',
        urgency: 'medium',
        location: 'TP. Hồ Chí Minh',
        lat: 10.7764,
        lng: 106.6854,
        deadline: '2026-11-20T17:00:00Z',
        preferred_min_condition: 3,
        contact_method: 'giaoan@tno.edu.vn',
        tags: ['device', 'computer', 'lab'],
        provenance: 'Nguồn chính thức: https://tno.edu.vn · Kiểm chứng: 27/10/2026',
      },
    ];

    // CREATE tables if absent
    const resTable: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resources'",
    );
    if (resTable.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        condition INTEGER DEFAULT 5,
        location TEXT NOT NULL,
        lat REAL,
        lng REAL,
        available_from TEXT,
        cost REAL DEFAULT 0,
        contact_method TEXT,
        status TEXT DEFAULT 'available',
        is_verified INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      );
      changes.push('created resources table');
    }
    const reqTable: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resource_requests'",
    );
    if (reqTable.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS resource_requests (
        id TEXT PRIMARY KEY NOT NULL,
        need_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        urgency TEXT DEFAULT 'medium',
        location TEXT NOT NULL,
        lat REAL,
        lng REAL,
        deadline TEXT,
        preferred_min_condition INTEGER DEFAULT 0,
        contact_method TEXT,
        status TEXT DEFAULT 'open',
        tags TEXT DEFAULT '[]',
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      );
      changes.push('created resource_requests table');
    }
    const matchTable: any[] = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resource_matches'",
    );
    if (matchTable.length === 0) {
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS resource_matches (
        id TEXT PRIMARY KEY NOT NULL,
        resource_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        match_score REAL DEFAULT 0,
        explanation TEXT,
        status TEXT DEFAULT 'pending',
        scheduled_pickup TEXT,
        transport_plan TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      );
      changes.push('created resource_matches table');
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_resource_matches_resource_id ON resource_matches(resource_id)',
      );
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_resource_matches_request_id ON resource_matches(request_id)',
      );
      await exec(
        db,
        'CREATE INDEX IF NOT EXISTS idx_resource_matches_status ON resource_matches(status)',
      );
    }

    // Seed demo resources if empty (real Vietnamese organisations)
    const resCount: any[] = await all(db, 'SELECT COUNT(*) AS count FROM resources');
    if (Number(resCount[0]?.count || 0) === 0) {
      for (const r of RESOURCES_SEED) {
        await exec(
          db,
          `INSERT INTO resources (id, type, title, description, condition, location, lat, lng, available_from, cost, contact_method, status, is_verified, tags, metadata) VALUES
          ('${r.id}', '${r.type}', '${r.title.replace(/'/g, "''")}', '${r.description.replace(/'/g, "''")}', ${r.condition}, '${r.location.replace(/'/g, "''")}', ${r.lat}, ${r.lng}, '${r.available_from || ''}', ${r.cost}, '${r.contact_method}', 'available', ${r.is_verified ? 1 : 0}, '${JSON.stringify(r.tags)}', '${JSON.stringify(r.metadata).replace(/'/g, "''")}')`,
        );
      }
      changes.push(`seeded ${RESOURCES_SEED.length} resources row(s)`);
    }
    // Seed demo requests if empty
    const reqCount: any[] = await all(db, 'SELECT COUNT(*) AS count FROM resource_requests');
    if (Number(reqCount[0]?.count || 0) === 0) {
      for (const q of RESOURCE_REQUESTS_SEED) {
        await exec(
          db,
          `INSERT INTO resource_requests (id, need_type, title, description, urgency, location, lat, lng, deadline, preferred_min_condition, contact_method, status, tags) VALUES
          ('${q.id}', '${q.need_type}', '${q.title.replace(/'/g, "''")}', '${q.description.replace(/'/g, "''")}', '${q.urgency}', '${q.location.replace(/'/g, "''")}', ${q.lat}, ${q.lng}, '${q.deadline || ''}', ${q.preferred_min_condition}, '${q.contact_method}', 'open', '${JSON.stringify(q.tags)}')`,
        );
      }
      changes.push(`seeded ${RESOURCE_REQUESTS_SEED.length} resource_requests row(s)`);
    }

    // Backfill donation_campaigns.location_point for the NULL campaigns
    // IDs match the deterministic UUIDs from scripts/real_vn_data.py (D.uid).
    // Hà Nội centre = (21.0285, 105.8342); TP.HCM centre = (10.7727, 106.6548).
    const donationBackfills: Array<[string, number, number]> = [
      ['4d63e3bc-bf9d-5b8e-99f0-d01c96527ba9', 21.0285, 105.8342], // Quỹ Vì trẻ em Việt Nam — Hà Nội
      ['dfa228fa-246d-5787-a2e6-58bdd2cac3c5', 21.0285, 105.8342], // Quỹ Tấm lòng Việt — Hà Nội
      ['330f9558-0167-5cb2-b96b-cb9ba1954545', 10.7727, 106.6548], // Operation Smile Vietnam — TP.HCM
      ['20f83aa8-2326-595a-b655-e55ef222db80', 10.7727, 106.6548], // Saigon Children's Charity — TP.HCM
      ['ab360a75-cc75-5eae-ad81-8be84c7fac10', 21.0285, 105.8342], // Blue Dragon — Hà Nội
      ['b7fe8ca0-c2c9-5207-9a54-25e81dd7acf8', 21.0285, 105.8342], // Sóng và máy tính cho em — Hà Nội (tập trung Bộ GD&ĐT)
      ['f3ef062e-acff-5e40-96c3-64037f738702', 21.0285, 105.8342], // Quỹ Cứu trợ Trung ương — Hà Nội
    ];
    for (const [id, lat, lng] of donationBackfills) {
      const res = await run(
        db,
        `UPDATE donation_campaigns SET location_point = '{"type":"Point","coordinates":[${lng},${lat}]}' WHERE id = '${id}' AND (location_point IS NULL OR location_point = '')`,
      );
      if (res.changes > 0)
        changes.push(`backfilled donation_campaigns.location_point for ${id} → [${lng},${lat}]`);
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
